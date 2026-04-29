from django.db import models


class Sale(models.Model):
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
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices)
    cash_received  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cash_change    = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    note           = models.TextField(blank=True)
    sold_by        = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    cash_session   = models.ForeignKey("cash.CashSession", on_delete=models.PROTECT, null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

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
