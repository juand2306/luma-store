from django.db import models


class PurchaseOrder(models.Model):
    """Orden de compra a proveedor para reabastecer inventario."""

    class Status(models.TextChoices):
        PENDING   = "pending",   "Pendiente"
        PARTIAL   = "partial",   "Parcial"
        RECEIVED  = "received",  "Recibida"
        CANCELLED = "cancelled", "Cancelada"

    number        = models.CharField(max_length=20, unique=True)   # OC-00001
    variant       = models.ForeignKey(
        "inventory.ProductVariant", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="purchase_orders"
    )
    product_name  = models.CharField(max_length=200)
    size          = models.CharField(max_length=50, blank=True)
    color         = models.CharField(max_length=50, blank=True)
    requested_qty = models.PositiveIntegerField()
    received_qty  = models.PositiveIntegerField(default=0)
    unit_cost     = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    note          = models.TextField(blank=True)
    status        = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    created_by    = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_purchases"
    )
    received_by   = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_purchases"
    )
    received_at   = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="purchase_status_date_idx"),
        ]

    def __str__(self):
        return f"{self.number} — {self.product_name}"


class Order(models.Model):
    class Status(models.TextChoices):
        NEW         = "new",         "Nuevo"
        IN_PROGRESS = "in_progress", "En gestión"
        CONFIRMED   = "confirmed",   "Confirmado"
        PREPARING   = "preparing",   "En preparación"
        SHIPPED     = "shipped",     "Enviado"
        DELIVERED   = "delivered",   "Entregado"
        CANCELLED   = "cancelled",   "Cancelado"

    number         = models.CharField(max_length=20, unique=True)  # Ej: PED-00001
    # FK al registro Customer deduplicado (null si pedido anónimo sin teléfono)
    customer       = models.ForeignKey(
        "customers.Customer",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="orders",
    )
    customer_name  = models.CharField(max_length=150, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)
    note           = models.TextField(blank=True)
    subtotal       = models.DecimalField(max_digits=12, decimal_places=2)
    total          = models.DecimalField(max_digits=12, decimal_places=2)
    status         = models.CharField(max_length=15, choices=Status.choices, default=Status.NEW)
    attended_by    = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="attended_orders"
    )
    # Preparado para pasarela de pagos (desactivada)
    payment_status = models.CharField(max_length=20, default="pending")
    payment_method = models.CharField(max_length=30, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"], name="order_status_date_idx"),
            models.Index(fields=["created_at"],            name="order_created_at_idx"),
        ]

    def __str__(self):
        return f"{self.number} — {self.get_status_display()}"


class OrderItem(models.Model):
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    variant    = models.ForeignKey("inventory.ProductVariant", on_delete=models.PROTECT)
    quantity   = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal   = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.variant} x{self.quantity}"


class OrderStatusHistory(models.Model):
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="history")
    status     = models.CharField(max_length=15)
    note       = models.TextField(blank=True)
    changed_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.order.number} → {self.status}"
