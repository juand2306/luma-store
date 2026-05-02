from rest_framework import viewsets, generics, status, filters
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from .models import Sale, SaleItem, Return
from .serializers import (
    SaleSerializer, SaleCreateSerializer,
    ReturnSerializer
)
from apps.users.permissions import IsOwnerOrAdmin, IsOwnerAdminOrSeller
from apps.inventory.models import ProductVariant, StockMovement
from apps.cash.models import CashSession, CashMovement


def get_open_session():
    """Obtiene la sesión de caja abierta del día actual."""
    today = timezone.now().date()
    return CashSession.objects.filter(date=today, status="open").first()


def generate_sale_number():
    """Genera el número correlativo de venta (VTA-00001, VTA-00002...).
    Usa el número de la última venta para evitar colisiones cuando se borran ventas.
    """
    last_number = Sale.objects.order_by('-id').values_list('number', flat=True).first()
    if not last_number:
        return "VTA-00001"
    try:
        next_num = int(last_number.rsplit('-', 1)[-1]) + 1
    except (ValueError, IndexError):
        next_num = Sale.objects.count() + 1
    return f"VTA-{next_num:05d}"


class SaleViewSet(viewsets.ModelViewSet):
    """Registro y consulta de ventas."""
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at", "total"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("create", "list", "retrieve"):
            return [IsOwnerAdminOrSeller()]
        return [IsOwnerOrAdmin()]

    def get_queryset(self):
        qs = Sale.objects.prefetch_related("items__variant__product").select_related(
            "customer", "sold_by", "cash_session"
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
        return qs

    def get_serializer_class(self):
        return SaleSerializer

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
        subtotal = 0
        sale_items = []
        for item in items_data:
            # Resolver variante a partir de variant_id o product_id
            vid = item.get("variant_id")
            pid = item.get("product_id")
            if vid:
                variant = ProductVariant.objects.get(id=vid)
            else:
                from apps.inventory.models import Product
                product_obj = Product.objects.prefetch_related("variants").get(id=pid)
                # Buscar primera variante activa con stock
                variant = product_obj.variants.filter(is_active=True, stock__gt=0).first()
                if not variant:
                    # Si no tiene ninguna, crear variante por defecto
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

        # 4. Aplicar descuento de puntos si aplica
        points_used = data.get("points_used", 0)
        discount = 0
        if points_used > 0 and data.get("customer"):
            from apps.customers.models import Customer, LoyaltyConfig
            try:
                customer = Customer.objects.get(id=data["customer"])
                config = LoyaltyConfig.objects.first()
                if config and config.is_enabled and customer.points >= points_used:
                    discount = points_used * float(config.value_per_point)
                    customer.points -= points_used
                    customer.save()
            except Exception:
                points_used = 0

        total = max(0, float(subtotal) - discount)

        # 5. Calcular vuelto si pago en efectivo
        cash_received = data.get("cash_received")
        cash_change = None
        if cash_received:
            cash_change = float(cash_received) - total

        # 6. Calcular puntos ganados
        points_earned = 0
        try:
            from apps.customers.models import LoyaltyConfig
            loyalty = LoyaltyConfig.objects.first()
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
            # Auto-actualizar estado del producto
            product = item["variant"].product
            if not product.variants.filter(is_active=True, stock__gt=0).exists():
                product.status = "out"
                product.save()

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

        # 10. Acreditar puntos ganados al cliente (re-fetch para evitar race conditions)
        if points_earned > 0 and sale.customer_id:
            from apps.customers.models import Customer
            try:
                cust = Customer.objects.get(pk=sale.customer_id)
                cust.points += points_earned
                cust.save(update_fields=["points"])
            except Exception:
                pass

        return Response(SaleSerializer(sale, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    http_method_names = ["get", "post", "head", "options"]  # Las ventas no se editan


class ReturnViewSet(viewsets.ModelViewSet):
    """Devoluciones y cambios de prendas."""
    queryset = Return.objects.select_related(
        "returned_variant__product", "swapped_variant__product",
        "original_sale", "processed_by"
    ).order_by("-created_at")
    permission_classes = [IsOwnerOrAdmin]

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
            StockMovement.objects.create(
                variant=swapped_variant,
                type=StockMovement.MovementType.SWAP_OUT,
                quantity=-swapped_qty,
                note=f"Cambio — salida",
                created_by=request.user,
            )
            # Revertir movimiento de inventario de entrada (el devuelto)
            StockMovement.objects.filter(
                variant=returned_variant,
                type=StockMovement.MovementType.RETURN
            ).last().delete()
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
            CashMovement.objects.filter(
                session=session,
                type=CashMovement.MovementType.REFUND,
                reference_id=None
            ).last().delete()

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

            data["swapped_price"] = swapped_price
            data["price_difference"] = price_difference

        return_obj = Return.objects.create(
            **data,
            price_difference=price_difference,
            processed_by=request.user,
            cash_session=session,
        )

        return Response(ReturnSerializer(return_obj).data, status=status.HTTP_201_CREATED)

    http_method_names = ["get", "post", "head", "options"]
