from django.db import models


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
