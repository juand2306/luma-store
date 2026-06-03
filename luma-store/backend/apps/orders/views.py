from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Count, Q, F, Sum, ExpressionWrapper, DecimalField
from django.utils import timezone

from .models import Order, OrderItem, OrderStatusHistory, PurchaseOrder
from .serializers import (
    OrderSerializer, OrderListSerializer,
    OrderUpdateSerializer, StoreOrderCreateSerializer,
    PurchaseOrderSerializer, PurchaseOrderUpdateSerializer, PurchaseReceiveSerializer,
)
from apps.users.permissions import IsOwnerOrAdmin
from apps.inventory.models import Product, ProductVariant, StockMovement


def generate_order_number():
    """
    Genera el número correlativo de pedido (PED-00001, PED-00002...).
    Usa el campo 'number' (no el id) para evitar colisiones si se eliminan registros.
    Debe llamarse DENTRO de un bloque transaction.atomic().
    """
    from django.db import connection
    qs = Order.objects.order_by("-id")
    if "sqlite" not in connection.vendor:
        qs = qs.select_for_update()
    last_number = qs.values_list("number", flat=True).first()
    if not last_number:
        return "PED-00001"
    try:
        next_num = int(last_number.rsplit("-", 1)[-1]) + 1
    except (ValueError, IndexError):
        next_num = Order.objects.count() + 1
    return f"PED-{next_num:05d}"


def fulfill_order(order, payment_method, user):
    """
    Convierte un pedido entregado en una Venta real.
    Retorna la Sale creada. Si ya existe, la retorna sin duplicar.
    """
    from apps.sales.models import Sale, SaleItem, generate_sale_number
    from apps.inventory.models import StockMovement, ProductVariant
    from apps.cash.models import CashSession, CashMovement

    if hasattr(order, "sale") and order.sale_id is not None:
        return order.sale

    sale = Sale.objects.create(
        number=generate_sale_number(),   # misma función y lock que las ventas directas
        order=order,
        customer=order.customer,         # propaga el FK deduplicado al historial de ventas
        subtotal=order.subtotal,
        total=order.total,
        payment_method=payment_method or "other",
        note=f"Generado desde pedido {order.number}",
        sold_by=user,
        cash_session=None,
    )

    # Prefetch items con variante y producto para que el loop no genere N+1
    items = list(order.items.select_related("variant__product").prefetch_related(
        "variant__product__variants"
    ))
    for item in items:
        SaleItem.objects.create(
            sale=sale,
            variant=item.variant,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
        )
        # Descuento de stock atómico — evita race condition bajo concurrencia
        ProductVariant.objects.filter(pk=item.variant.pk).update(
            stock=F("stock") - item.quantity
        )
        StockMovement.objects.create(
            variant=item.variant,
            type=StockMovement.MovementType.SALE,
            quantity=-item.quantity,
            note=f"Pedido {order.number} · Venta {sale.number}",
            reference_id=sale.id,
            created_by=user,
        )
        # Usa prefetch cache de variantes del producto — 0 queries extra
        product = item.variant.product
        has_stock = any(
            v.is_active and v.stock > 0
            for v in product.variants.all()
        )
        if not has_stock:
            # Actualización atómica: solo actualiza si sigue activo (evita race condition)
            Product.objects.filter(pk=product.pk, status="active").update(status="out")

    today = timezone.now().date()
    session = CashSession.objects.filter(date=today, status="open").first()
    if session:
        sale.cash_session = session
        sale.save(update_fields=["cash_session"])
        CashMovement.objects.create(
            session=session,
            type=CashMovement.MovementType.INCOME,
            amount=order.total,
            description=f"Pedido {order.number} · Venta {sale.number}",
            payment_method=payment_method or "other",
            reference_id=sale.id,
            created_by=user,
        )

    return sale


def generate_purchase_number():
    """
    Genera el número correlativo de OC (OC-00001, OC-00002...).
    Usa el campo 'number' (no el id) para evitar colisiones si se eliminan OC canceladas.
    Debe llamarse DENTRO de un bloque transaction.atomic().
    """
    from django.db import connection
    qs = PurchaseOrder.objects.order_by("-id")
    if "sqlite" not in connection.vendor:
        qs = qs.select_for_update()
    last_number = qs.values_list("number", flat=True).first()
    if not last_number:
        return "OC-00001"
    try:
        next_num = int(last_number.rsplit("-", 1)[-1]) + 1
    except (ValueError, IndexError):
        next_num = PurchaseOrder.objects.count() + 1
    return f"OC-{next_num:05d}"


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """CRUD de órdenes de compra a proveedor."""
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        qs = PurchaseOrder.objects.select_related(
            "variant__product", "created_by", "received_by"
        )
        status_f = self.request.query_params.get("status")
        search   = self.request.query_params.get("search")
        if status_f:
            qs = qs.filter(status=status_f)
        if search:
            qs = qs.filter(
                Q(product_name__icontains=search) | Q(number__icontains=search)
            )
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action in ["update", "partial_update"]:
            return PurchaseOrderUpdateSerializer
        if self.action == "receive":
            return PurchaseReceiveSerializer
        return PurchaseOrderSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        variant    = None
        variant_id = request.data.get("variant")

        if variant_id:
            try:
                variant = ProductVariant.objects.select_related("product").get(id=variant_id)
            except ProductVariant.DoesNotExist:
                return Response({"variant": "Variante no encontrada."}, status=status.HTTP_400_BAD_REQUEST)

        requested_qty = request.data.get("requested_qty")
        if not requested_qty or int(requested_qty) < 1:
            return Response({"requested_qty": "Debe ser al menos 1."}, status=status.HTTP_400_BAD_REQUEST)

        product_name = request.data.get("product_name") or (variant.product.name if variant else "")
        size         = request.data.get("size")  or (variant.size  if variant else "")
        color        = request.data.get("color") or (variant.color if variant else "")

        if not product_name:
            return Response({"product_name": "Requerido cuando no se selecciona variante."}, status=status.HTTP_400_BAD_REQUEST)

        unit_cost = request.data.get("unit_cost") or None

        purchase = PurchaseOrder.objects.create(
            number        = generate_purchase_number(),
            variant       = variant,
            product_name  = product_name,
            size          = size,
            color         = color,
            requested_qty = int(requested_qty),
            unit_cost     = unit_cost,
            note          = request.data.get("note", ""),
            created_by    = request.user,
        )
        return Response(PurchaseOrderSerializer(purchase).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Conteos globales de OC (sin filtros de búsqueda — panel de control)."""
        qs = PurchaseOrder.objects.all()
        result = qs.aggregate(
            pending=Count("id", filter=Q(status="pending")),
            partial=Count("id", filter=Q(status="partial")),
            received=Count("id", filter=Q(status="received")),
            cancelled=Count("id", filter=Q(status="cancelled")),
            pending_value=Sum(
                ExpressionWrapper(
                    F("unit_cost") * (F("requested_qty") - F("received_qty")),
                    output_field=DecimalField(),
                ),
                filter=Q(status__in=["pending", "partial"], unit_cost__isnull=False),
            ),
        )
        return Response({
            "pending":       result["pending"]       or 0,
            "partial":       result["partial"]       or 0,
            "received":      result["received"]      or 0,
            "cancelled":     result["cancelled"]     or 0,
            "pending_value": float(result["pending_value"] or 0),
        })

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        purchase   = self.get_object()
        serializer = PurchaseOrderUpdateSerializer(purchase, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # No permitir cambiar requested_qty si ya hay recepciones
        if "requested_qty" in serializer.validated_data and purchase.received_qty > 0:
            new_qty = serializer.validated_data["requested_qty"]
            if new_qty < purchase.received_qty:
                return Response(
                    {"requested_qty": f"No puede ser menor que lo ya recibido ({purchase.received_qty})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        serializer.save()
        return Response(PurchaseOrderSerializer(purchase).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def receive(self, request, pk=None):
        """Registra la recepción de mercancía: actualiza stock e inventario."""
        purchase = self.get_object()

        if purchase.status == PurchaseOrder.Status.CANCELLED:
            return Response({"detail": "No se puede recibir una OC cancelada."}, status=status.HTTP_400_BAD_REQUEST)
        if purchase.status == PurchaseOrder.Status.RECEIVED:
            return Response({"detail": "Esta OC ya fue recibida completamente."}, status=status.HTTP_400_BAD_REQUEST)

        recv = PurchaseReceiveSerializer(data=request.data)
        recv.is_valid(raise_exception=True)
        qty            = recv.validated_data["qty_received"]
        payment_method = recv.validated_data["payment_method"]
        recv_note      = recv.validated_data["note"]

        pending = purchase.requested_qty - purchase.received_qty
        if qty > pending:
            return Response(
                {"qty_received": f"Solo se esperan {pending} unidades más."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Actualizar stock de variante ──────────────────────────────────────
        if purchase.variant_id:
            # Actualización atómica: evita race condition bajo concurrencia
            ProductVariant.objects.filter(pk=purchase.variant_id).update(
                stock=F("stock") + qty
            )
            variant = purchase.variant  # instancia en memoria para FK en StockMovement
            variant.refresh_from_db(fields=["stock"])  # Evita stock stale en la respuesta

            StockMovement.objects.create(
                variant      = variant,
                type         = StockMovement.MovementType.ENTRY,
                quantity     = qty,
                note         = recv_note or f"Recepción {purchase.number}",
                reference_id = purchase.id,
                created_by   = request.user,
            )

            # Reactivar producto si estaba agotado (update atómico, sin read-modify-write)
            Product.objects.filter(pk=variant.product_id, status="out").update(status="active")

        # ── Actualizar OC ─────────────────────────────────────────────────────
        purchase.received_qty += qty
        purchase.received_by   = request.user
        purchase.received_at   = timezone.now()
        purchase.status = (
            PurchaseOrder.Status.RECEIVED
            if purchase.received_qty >= purchase.requested_qty
            else PurchaseOrder.Status.PARTIAL
        )
        purchase.save(update_fields=["received_qty", "received_by", "received_at", "status"])

        # ── Movimiento de caja (egreso) si hay costo y método de pago ─────────
        if payment_method and purchase.unit_cost:
            from apps.cash.models import CashSession, CashMovement
            session = CashSession.objects.filter(date=timezone.localdate(), status="open").first()
            if session:
                CashMovement.objects.create(
                    session        = session,
                    type           = CashMovement.MovementType.EXPENSE,
                    amount         = purchase.unit_cost * qty,
                    description    = f"Compra {purchase.number} — {purchase.product_name}",
                    payment_method = payment_method,
                    reference_id   = purchase.id,
                    created_by     = request.user,
                )

        return Response(PurchaseOrderSerializer(purchase).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """Cancela una OC pendiente o parcial."""
        purchase = self.get_object()
        if purchase.status == PurchaseOrder.Status.RECEIVED:
            return Response({"detail": "No se puede cancelar una OC ya recibida."}, status=status.HTTP_400_BAD_REQUEST)
        if purchase.status == PurchaseOrder.Status.CANCELLED:
            return Response({"detail": "Ya está cancelada."}, status=status.HTTP_400_BAD_REQUEST)
        purchase.status = PurchaseOrder.Status.CANCELLED
        purchase.save(update_fields=["status"])
        return Response(PurchaseOrderSerializer(purchase).data)

    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()
        if purchase.status not in [PurchaseOrder.Status.PENDING, PurchaseOrder.Status.CANCELLED]:
            return Response(
                {"detail": "Solo se pueden eliminar OC pendientes o canceladas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class OrderViewSet(viewsets.ModelViewSet):
    """Gestión de pedidos del portal (panel de administración)."""
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        # Lista liviana: solo prefetch items (para item_count) y sale (para sale_number).
        # Detalle/update: carga completo con historial y variantes para el serializer.
        if self.action == "list":
            base = Order.objects.prefetch_related("items").select_related("sale")
        else:
            base = Order.objects.prefetch_related(
                "items__variant__product", "history__changed_by"
            ).select_related("attended_by", "sale")

        qs = base.order_by("-created_at")

        status_filter = self.request.query_params.get("status")
        search        = self.request.query_params.get("search")
        from_date     = self.request.query_params.get("from_date")
        to_date       = self.request.query_params.get("to_date")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(customer_name__icontains=search)
                | Q(customer_phone__icontains=search)
                | Q(number__icontains=search)
            )
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        return qs

    def get_serializer_class(self):
        if self.action in ("list", "stats"):
            return OrderListSerializer
        if self.action in ["update", "partial_update"]:
            return OrderUpdateSerializer
        return OrderSerializer

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Conteos de pedidos por grupo de estado, con los mismos filtros que el listado."""
        qs = self.get_queryset()
        result = qs.aggregate(
            total       = Count("id"),
            new         = Count("id", filter=Q(status="new")),
            in_progress = Count("id", filter=Q(status__in=[
                "in_progress", "confirmed", "preparing", "shipped"
            ])),
            done        = Count("id", filter=Q(status__in=["delivered", "cancelled"])),
        )
        return Response(result)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Cambiar estado del pedido y registrar en historial.
        Al pasar a 'delivered', genera automáticamente la Venta y descuenta inventario.
        """
        order      = self.get_object()
        old_status = order.status
        partial    = kwargs.pop("partial", False)
        serializer = OrderUpdateSerializer(order, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data.get("status", order.status)

        if new_status and new_status != old_status:
            serializer.save(attended_by=request.user)
            OrderStatusHistory.objects.create(
                order=order,
                status=new_status,
                note=request.data.get("note", ""),
                changed_by=request.user,
            )
            # Auto-fulfillment al marcar como entregado
            if new_status == Order.Status.DELIVERED:
                payment_method = request.data.get("payment_method", "other")
                fulfill_order(order, payment_method, request.user)

            # Notificar al cliente sobre el nuevo estado (solo estados relevantes)
            from apps.notifications.emails import send_order_status_update
            _status = new_status
            transaction.on_commit(lambda: send_order_status_update(order, _status))
        else:
            serializer.save()

        # Refetch con todos los related necesarios para el serializer (refresh_from_db
        # limpia el prefetch cache y causaría N+1 en items/history/sale)
        order = (
            Order.objects
            .prefetch_related("items__variant__product", "history__changed_by")
            .select_related("attended_by", "sale")
            .get(pk=order.pk)
        )
        return Response(OrderSerializer(order, context={"request": request}).data)

    http_method_names = ["get", "put", "patch", "head", "options"]


class StoreOrderCreateView(generics.CreateAPIView):
    """Crear pedido desde el portal de clientes (SIN autenticación)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        from apps.customers.models import Customer

        serializer = StoreOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Deduplicar cliente por teléfono: reutiliza registro existente o crea uno nuevo.
        # Si el cliente proporciona email, se almacena en su registro para notificaciones.
        # Retorna None si el comprador no proporcionó teléfono (pedido anónimo).
        customer = Customer.get_or_create_by_phone(
            phone=data.get("customer_phone", ""),
            name=data.get("customer_name", ""),
            email=data.get("customer_email", ""),
        )

        # Bulk-fetch variantes en una sola query (la validación ya las tiene, pero
        # validated_data solo guarda los dicts de entrada, no los objetos)
        variant_ids  = [item["variant_id"] for item in data["items"]]
        variants_map = {
            v.id: v
            for v in ProductVariant.objects.filter(
                id__in=variant_ids
            ).select_related("product")
        }

        subtotal    = 0
        order_items = []

        for item in data["items"]:
            variant        = variants_map[item["variant_id"]]
            unit_price     = variant.get_price()
            item_subtotal  = unit_price * item["quantity"]
            subtotal      += float(item_subtotal)
            order_items.append({
                "variant":    variant,
                "quantity":   item["quantity"],
                "unit_price": unit_price,
                "subtotal":   item_subtotal,
            })

        order = Order.objects.create(
            number=generate_order_number(),
            customer=customer,
            customer_name=data.get("customer_name", ""),
            customer_phone=data.get("customer_phone", ""),
            note=data.get("note", ""),
            subtotal=subtotal,
            total=subtotal,
            status=Order.Status.NEW,
        )

        for item in order_items:
            OrderItem.objects.create(
                order=order,
                variant=item["variant"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                subtotal=item["subtotal"],
            )

        OrderStatusHistory.objects.create(
            order=order,
            status=Order.Status.NEW,
            note="Pedido recibido desde el portal online.",
        )

        # Enviar confirmación por email al cliente (si tiene email registrado).
        # transaction.on_commit garantiza que el email solo se envía si la
        # transacción confirma exitosamente — nunca para pedidos revertidos.
        from apps.notifications.emails import send_order_confirmation
        transaction.on_commit(lambda: send_order_confirmation(order))

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
