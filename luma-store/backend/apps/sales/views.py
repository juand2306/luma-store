from rest_framework import viewsets, generics, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Avg, Count, F
from django.utils import timezone

from .models import Sale, SaleItem, Return, generate_sale_number
from .serializers import (
    SaleSerializer, SaleCreateSerializer,
    ReturnSerializer
)
from apps.users.permissions import IsOwnerOrAdmin, IsOwnerAdminOrSeller
from apps.inventory.models import Product, ProductVariant, StockMovement
from apps.cash.models import CashSession, CashMovement


def get_open_session():
    """Obtiene la sesión de caja abierta del día actual."""
    today = timezone.localdate()
    return CashSession.objects.filter(date=today, status="open").first()



class SaleViewSet(viewsets.ModelViewSet):
    """Registro y consulta de ventas."""
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "total"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("create", "list", "retrieve", "stats"):
            return [IsOwnerAdminOrSeller()]
        return [IsOwnerOrAdmin()]

    def get_queryset(self):
        qs = Sale.objects.prefetch_related("items__variant__product").select_related(
            "customer", "sold_by", "cash_session", "order"
        ).order_by("-created_at")
        # Sellers can only see their own sales
        if self.request.user.role == "seller":
            qs = qs.filter(sold_by=self.request.user)
        # Filtros opcionales
        from_date = self.request.query_params.get("from_date")
        to_date   = self.request.query_params.get("to_date")
        payment   = self.request.query_params.get("payment_method")
        seller    = self.request.query_params.get("sold_by")
        customer  = self.request.query_params.get("customer")
        number    = self.request.query_params.get("number")
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        if payment:
            qs = qs.filter(payment_method=payment)
        if seller:
            qs = qs.filter(sold_by=seller)
        if customer:
            qs = qs.filter(customer_id=customer)
        if number:
            qs = qs.filter(number__icontains=number)
        # Búsqueda combinada: número de venta O nombre de cliente
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(number__icontains=search) | Q(customer__name__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        return SaleSerializer

    def get_serializer(self, *args, **kwargs):
        """Inyecta store_config en el contexto para que SaleSerializer
        resuelva payment_method_display en una sola llamada (no N veces)."""
        ctx = kwargs.pop("context", self.get_serializer_context())
        from apps.users.models import StoreConfig
        try:
            ctx["store_config"] = StoreConfig.get_config()
        except Exception:
            ctx["store_config"] = None
        kwargs["context"] = ctx
        return super().get_serializer(*args, **kwargs)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Totales agregados de ventas con los mismos filtros que el listado."""
        qs = self.get_queryset()
        result = qs.aggregate(
            total_revenue=Sum("total"),
            avg_ticket=Avg("total"),
            count=Count("id"),
        )
        return Response({
            "total_revenue": float(result["total_revenue"] or 0),
            "avg_ticket":    float(result["avg_ticket"]    or 0),
            "count":         result["count"]               or 0,
        })

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Registrar una venta: valida stock, descuenta inventario, registra en caja."""
        # 1. Verificar que hay caja abierta
        session = get_open_session()
        if not session:
            return Response(
                {"detail": "No hay caja abierta hoy. Abra la caja antes de registrar ventas."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Validar los datos de entrada
        serializer = SaleCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # 3. Calcular subtotales — manejar variant_id y product_id
        items_data = data["items"]

        # Bulk-fetch de variantes por ID en una sola query (la validación ya
        # comprobó existencia y stock, así que aquí solo necesitamos el objeto)
        named_variant_ids = [i["variant_id"] for i in items_data if i.get("variant_id")]
        variants_by_id = {}
        if named_variant_ids:
            variants_by_id = {
                v.id: v
                for v in ProductVariant.objects.filter(id__in=named_variant_ids).select_related("product")
            }

        subtotal = 0
        sale_items = []
        for item in items_data:
            vid = item.get("variant_id")
            pid = item.get("product_id")
            if vid:
                variant = variants_by_id[vid]
            else:
                product_obj = Product.objects.prefetch_related("variants").get(id=pid)
                # Filtra en Python usando el prefetch cache — evita N+1
                variant = next(
                    (v for v in product_obj.variants.all() if v.is_active and v.stock > 0),
                    None
                )
                if not variant:
                    variant = ProductVariant.objects.create(
                        product=product_obj,
                        size="ÚNICA",
                        color="Único",
                        stock=0,
                        is_active=True,
                    )
            unit_price = variant.get_price()
            item_subtotal = unit_price * item["quantity"]
            subtotal += item_subtotal
            sale_items.append({
                "variant": variant,
                "quantity": item["quantity"],
                "unit_price": unit_price,
                "subtotal": item_subtotal,
            })

        # 4. Cargar configuración de fidelización (UNA sola query, compartida en steps 4 y 6)
        from apps.customers.models import LoyaltyConfig
        loyalty = LoyaltyConfig.objects.first()

        # 4b. Aplicar descuento de puntos si aplica (operación atómica con F())
        points_used = data.get("points_used", 0)
        discount = 0
        if points_used > 0 and data.get("customer") and loyalty and loyalty.is_enabled:
            from apps.customers.models import Customer
            # filter + update atómico: solo descuenta si hay saldo suficiente
            updated = Customer.objects.filter(
                pk=data["customer"],
                points__gte=points_used,
            ).update(points=F("points") - points_used)
            if updated:
                discount = points_used * float(loyalty.value_per_point)
            else:
                points_used = 0  # no había saldo suficiente

        total = max(0, float(subtotal) - discount)

        # 5. Calcular vuelto si pago en efectivo
        cash_received = data.get("cash_received")
        cash_change = None
        if cash_received:
            cash_change = float(cash_received) - total

        # 6. Calcular puntos ganados (reutiliza loyalty del step 4)
        points_earned = 0
        try:
            if loyalty and loyalty.is_enabled and data.get("customer"):
                ppa = float(loyalty.points_per_amount or 0)
                if ppa > 0:
                    points_earned = int(total / ppa)
        except Exception:
            points_earned = 0

        # 7. Crear la venta
        sale = Sale.objects.create(
            number=generate_sale_number(),
            customer_id=data.get("customer"),
            subtotal=subtotal,
            total=total,
            points_used=points_used,
            points_earned=points_earned,
            payment_method=data["payment_method"],
            cash_received=cash_received,
            cash_change=cash_change,
            note=data.get("note", ""),
            sold_by=request.user,
            cash_session=session,
        )

        # 8. Crear ítems, descontar stock y crear movimientos de inventario
        for item in sale_items:
            SaleItem.objects.create(
                sale=sale,
                variant=item["variant"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                subtotal=item["subtotal"],
            )
            # Descontar stock
            item["variant"].stock -= item["quantity"]
            item["variant"].save()
            # Movimiento de inventario tipo VENTA
            StockMovement.objects.create(
                variant=item["variant"],
                type=StockMovement.MovementType.SALE,
                quantity=-item["quantity"],
                note=f"Venta {sale.number}",
                reference_id=sale.id,
                created_by=request.user,
            )
            # Auto-actualizar estado del producto (sin tocar variant.product — usa FK int)
            product_id = item["variant"].product_id  # FK integer, no DB query
            has_stock = ProductVariant.objects.filter(
                product_id=product_id, is_active=True, stock__gt=0
            ).exists()
            if not has_stock:
                Product.objects.filter(pk=product_id, status="active").update(status="out")
            else:
                Product.objects.filter(pk=product_id, status="out").update(status="active")

        # 9. Registrar ingreso en caja
        CashMovement.objects.create(
            session=session,
            type=CashMovement.MovementType.INCOME,
            amount=total,
            description=f"Venta {sale.number}",
            payment_method=data["payment_method"],
            reference_id=sale.id,
            created_by=request.user,
        )

        # 10. Acreditar puntos ganados al cliente (update atómico con F(), sin re-fetch)
        if points_earned > 0 and sale.customer_id:
            from apps.customers.models import Customer
            try:
                Customer.objects.filter(pk=sale.customer_id).update(
                    points=F("points") + points_earned
                )
            except Exception:
                pass

        from apps.users.models import StoreConfig
        try:
            store_config = StoreConfig.get_config()
        except Exception:
            store_config = None
        return Response(
            SaleSerializer(sale, context={"request": request, "store_config": store_config}).data,
            status=status.HTTP_201_CREATED,
        )

    http_method_names = ["get", "post", "head", "options"]  # Las ventas no se editan


class ReturnViewSet(viewsets.ModelViewSet):
    """Devoluciones y cambios de prendas."""
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        """get_queryset() en lugar de queryset de clase para evitar datos stale."""
        return Return.objects.select_related(
            "returned_variant__product", "swapped_variant__product",
            "original_sale", "processed_by"
        ).order_by("-created_at")

    def get_serializer_class(self):
        return ReturnSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Procesar devolución o cambio con ajuste de stock y caja."""
        session = get_open_session()
        if not session:
            return Response(
                {"detail": "No hay caja abierta hoy."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ReturnSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        returned_variant = data["returned_variant"]
        returned_qty = data["returned_quantity"]
        returned_price = data["returned_price"]
        price_difference = 0
        movement_type = Return.ReturnType.RETURN

        # --- DEVOLUCIÓN ---
        returned_variant.stock += returned_qty
        returned_variant.save()
        # Si el producto estaba sin stock, reactivarlo
        Product.objects.filter(pk=returned_variant.product_id, status="out").update(status="active")
        StockMovement.objects.create(
            variant=returned_variant,
            type=StockMovement.MovementType.RETURN,
            quantity=returned_qty,
            note=f"Devolución: {data.get('reason', '')}",
            created_by=request.user,
        )
        # Egreso en caja por devolución
        refund_amount = float(returned_price) * returned_qty
        CashMovement.objects.create(
            session=session,
            type=CashMovement.MovementType.REFUND,
            amount=refund_amount,
            description=f"Devolución — {returned_variant}",
            payment_method="cash",
            created_by=request.user,
        )

        # --- CAMBIO (si aplica) ---
        if data.get("type") == "swap" and data.get("swapped_variant"):
            movement_type = Return.ReturnType.SWAP
            swapped_variant = data["swapped_variant"]
            swapped_qty = data["swapped_quantity"]
            swapped_price = data["swapped_price"] or swapped_variant.get_price()

            # Stock de la variante que sale
            swapped_variant.stock -= swapped_qty
            swapped_variant.save()
            # Actualizar estado del producto si se quedó sin stock
            has_stock = ProductVariant.objects.filter(
                product_id=swapped_variant.product_id, is_active=True, stock__gt=0
            ).exists()
            if not has_stock:
                Product.objects.filter(pk=swapped_variant.product_id, status="active").update(status="out")
            StockMovement.objects.create(
                variant=swapped_variant,
                type=StockMovement.MovementType.SWAP_OUT,
                quantity=-swapped_qty,
                note=f"Cambio — salida",
                created_by=request.user,
            )
            # Revertir movimiento de inventario de entrada (el devuelto)
            _sm = StockMovement.objects.filter(
                variant=returned_variant,
                type=StockMovement.MovementType.RETURN
            ).last()
            if _sm:
                _sm.delete()
            StockMovement.objects.create(
                variant=returned_variant,
                type=StockMovement.MovementType.SWAP_IN,
                quantity=returned_qty,
                note=f"Cambio — entrada",
                created_by=request.user,
            )

            # Calcular diferencia de precio
            price_difference = (
                float(swapped_price) * swapped_qty
                - float(returned_price) * returned_qty
            )
            # Revertir el egreso de caja (no hay devolución, es un cambio)
            _cm = CashMovement.objects.filter(
                session=session,
                type=CashMovement.MovementType.REFUND,
                reference_id=None
            ).last()
            if _cm:
                _cm.delete()

            # Si el cliente paga diferencia positiva
            if price_difference > 0:
                CashMovement.objects.create(
                    session=session,
                    type=CashMovement.MovementType.INCOME,
                    amount=price_difference,
                    description=f"Diferencia de cambio — {swapped_variant}",
                    payment_method="cash",
                    created_by=request.user,
                )
            # Si la tienda debe devolver
            elif price_difference < 0:
                CashMovement.objects.create(
                    session=session,
                    type=CashMovement.MovementType.REFUND,
                    amount=abs(price_difference),
                    description=f"Diferencia de cambio — devolución al cliente",
                    payment_method="cash",
                    created_by=request.user,
                )

            # Normalizar swapped_price en data (puede haber llegado como None)
            data["swapped_price"] = swapped_price
            # NOTA: NO poner price_difference en data — se pasa como kwarg explícito
            # para evitar duplicado de clave al hacer **data + price_difference=...

        return_obj = Return.objects.create(
            **data,
            price_difference=price_difference,
            processed_by=request.user,
            cash_session=session,
        )

        return Response(ReturnSerializer(return_obj).data, status=status.HTTP_201_CREATED)

    http_method_names = ["get", "post", "head", "options"]
