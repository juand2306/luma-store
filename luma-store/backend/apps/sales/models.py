from django.db import models


def generate_sale_number():
    """
    Genera el siguiente número correlativo de venta (VTA-00001, VTA-00002...).
    Centralizado aquí para que tanto sales/views.py como orders/views.py
    usen exactamente la misma lógica y el mismo lock de concurrencia.
    Debe llamarse DENTRO de un bloque transaction.atomic().
    """
    from django.db import connection
    qs = Sale.objects.order_by("-id")
    if "sqlite" not in connection.vendor:
        # En PostgreSQL: bloquea la última fila hasta que termine la transacción,
        # evitando que dos workers lean el mismo número al mismo tiempo.
        qs = qs.select_for_update()
    last_number = qs.values_list("number", flat=True).first()
    if not last_number:
        return "VTA-00001"
    try:
        next_num = int(last_number.rsplit("-", 1)[-1]) + 1
    except (ValueError, IndexError):
        next_num = Sale.objects.count() + 1
    return f"VTA-{next_num:05d}"


class Sale(models.Model):
    # Conservamos el enum solo como referencia de los métodos base del sistema.
    # La validación real se hace en el serializer contra StoreConfig.payment_methods,
    # por lo que el campo ya NO usa choices para permitir métodos personalizados.
    class PaymentMethod(models.TextChoices):
        CASH      = "cash",      "Efectivo"
        TRANSFER  = "transfer",  "Transferencia"
        DEBIT     = "debit",     "Tarjeta Débito"
        CREDIT    = "credit",    "Tarjeta Crédito"
        NEQUI     = "nequi",     "Nequi"
        DAVIPLATA = "daviplata", "Daviplata"
        OTHER     = "other",     "Otro"

    number         = models.CharField(max_length=20, unique=True)  # Ej: VTA-00042
    order          = models.OneToOneField(                          # Pedido de origen (portal)
        "orders.Order", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sale"
    )
    customer       = models.ForeignKey(
        "customers.Customer", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sales"
    )
    subtotal       = models.DecimalField(max_digits=12, decimal_places=2)
    total          = models.DecimalField(max_digits=12, decimal_places=2)
    points_used    = models.PositiveIntegerField(default=0)
    points_earned  = models.PositiveIntegerField(default=0)
    payment_method = models.CharField(max_length=50)  # sin choices → acepta métodos configurables
    cash_received  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cash_change    = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    note           = models.TextField(blank=True)
    sold_by        = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    cash_session   = models.ForeignKey("cash.CashSession", on_delete=models.PROTECT, null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["created_at"],        name="sale_created_at_idx"),
            models.Index(fields=["payment_method"],    name="sale_payment_method_idx"),
            models.Index(fields=["sold_by", "created_at"], name="sale_seller_date_idx"),
            models.Index(fields=["customer", "created_at"], name="sale_customer_date_idx"),
        ]

    def __str__(self):
        return f"{self.number} — ${self.total}"


class SaleItem(models.Model):
    sale       = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    variant    = models.ForeignKey("inventory.ProductVariant", on_delete=models.PROTECT)
    quantity   = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal   = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.variant} x{self.quantity}"


class Return(models.Model):
    class ReturnType(models.TextChoices):
        RETURN = "return", "Devolución"
        SWAP   = "swap",   "Cambio"

    class Reason(models.TextChoices):
        DAMAGED  = "damaged",  "Prenda dañada"
        SIZE     = "size",     "Talla incorrecta"
        ORDER    = "order",    "Encargo no aceptado"
        OTHER    = "other",    "Otro"

    type              = models.CharField(max_length=10, choices=ReturnType.choices)
    reason            = models.CharField(max_length=10, choices=Reason.choices)
    original_sale     = models.ForeignKey(Sale, on_delete=models.SET_NULL, null=True, blank=True)
    returned_variant  = models.ForeignKey(
        "inventory.ProductVariant", on_delete=models.PROTECT, related_name="returns"
    )
    returned_quantity = models.PositiveIntegerField()
    returned_price    = models.DecimalField(max_digits=12, decimal_places=2)
    # Si es cambio (swap):
    swapped_variant   = models.ForeignKey(
        "inventory.ProductVariant", on_delete=models.PROTECT,
        null=True, blank=True, related_name="swaps"
    )
    swapped_quantity  = models.PositiveIntegerField(null=True, blank=True)
    swapped_price     = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    price_difference  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    note              = models.TextField(blank=True)
    processed_by      = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    cash_session      = models.ForeignKey("cash.CashSession", on_delete=models.PROTECT, null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_type_display()} — {self.returned_variant}"
