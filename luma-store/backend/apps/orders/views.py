from rest_framework import viewsets, generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone

from .models import Order, OrderItem, OrderStatusHistory
from .serializers import (
    OrderSerializer, OrderListSerializer,
    OrderUpdateSerializer, StoreOrderCreateSerializer
)
from apps.users.permissions import IsOwnerOrAdmin
from apps.inventory.models import ProductVariant


def generate_order_number():
    """Genera el número correlativo de pedido (PED-00001, PED-00002...)."""
    last = Order.objects.order_by("-id").first()
    num = (last.id + 1) if last else 1
    return f"PED-{num:05d}"


def fulfill_order(order, payment_method, user):
    """
    Convierte un pedido entregado en una Venta real.
    - Crea el registro Sale vinculado al Order (trazabilidad permanente).
    - Descuenta stock de cada variante.
    - Crea StockMovement de tipo 'sale' por cada ítem.
    - Registra ingreso en la caja abierta del día (si existe).
    Retorna la Sale creada. Si ya existe, la retorna sin duplicar.
    """
    from apps.sales.models import Sale, SaleItem
    from apps.inventory.models import StockMovement
    from apps.cash.models import CashSession, CashMovement

    # Evitar duplicar si ya se generó la venta anteriormente
    if hasattr(order, "sale") and order.sale_id is not None:
        return order.sale

    # Número correlativo de venta
    last_sale = Sale.objects.order_by("-id").first()
    sale_num = (last_sale.id + 1) if last_sale else 1
    sale_number = f"VTA-{sale_num:05d}"

    sale = Sale.objects.create(
        number=sale_number,
        order=order,
        subtotal=order.subtotal,
        total=order.total,
        payment_method=payment_method or "other",
        note=f"Generado desde pedido {order.number}",
        sold_by=user,
        cash_session=None,
    )

    for item in order.items.select_related("variant__product"):
        SaleItem.objects.create(
            sale=sale,
            variant=item.variant,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
        )
        # Descontar stock
        item.variant.stock = max(0, item.variant.stock - item.quantity)
        item.variant.save(update_fields=["stock"])
        # Movimiento de inventario tipo VENTA
        StockMovement.objects.create(
            variant=item.variant,
            type=StockMovement.MovementType.SALE,
            quantity=-item.quantity,
            note=f"Pedido {order.number} · Venta {sale.number}",
            reference_id=sale.id,
            created_by=user,
        )
        # Actualizar estado producto si agotado
        product = item.variant.product
        if not product.variants.filter(is_active=True, stock__gt=0).exists():
            product.status = "out"
            product.save(update_fields=["status"])

    # Registrar ingreso en caja si hay sesión abierta
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


class OrderViewSet(viewsets.ModelViewSet):
    """Gestión de pedidos del portal (panel de administración)."""
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        qs = Order.objects.prefetch_related(
            "items__variant__product", "history__changed_by"
        ).select_related("attended_by", "sale").order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        from_date     = self.request.query_params.get("from_date")
        to_date       = self.request.query_params.get("to_date")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return OrderListSerializer
        if self.action in ["update", "partial_update"]:
            return OrderUpdateSerializer
        return OrderSerializer

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
        else:
            serializer.save()

        order.refresh_from_db()
        return Response(OrderSerializer(order, context={"request": request}).data)

    http_method_names = ["get", "put", "patch", "head", "options"]


class StoreOrderCreateView(generics.CreateAPIView):
    """Crear pedido desde el portal de clientes (SIN autenticación)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = StoreOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        subtotal    = 0
        order_items = []

        for item in data["items"]:
            variant        = ProductVariant.objects.get(id=item["variant_id"])
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

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
