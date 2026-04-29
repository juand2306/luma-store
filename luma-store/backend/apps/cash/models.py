from django.db import models


class CashSession(models.Model):
    """Una sesión de caja = un día de operación."""
    class Status(models.TextChoices):
        OPEN   = "open",   "Abierta"
        CLOSED = "closed", "Cerrada"

    date           = models.DateField(unique=True)  # Solo una caja por día
    opening_amount = models.DecimalField(max_digits=12, decimal_places=2)
    closing_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    counted_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text="Lo que el usuario contó físicamente al cerrar"
    )
    difference     = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    note           = models.TextField(blank=True)
    opened_by      = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="opened_sessions"
    )
    closed_by      = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="closed_sessions"
    )
    opened_at      = models.DateTimeField(auto_now_add=True)
    closed_at      = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Caja {self.date} — {self.get_status_display()}"


class CashMovement(models.Model):
    class MovementType(models.TextChoices):
        INCOME  = "income",  "Ingreso"
        EXPENSE = "expense", "Egreso"
        REFUND  = "refund",  "Devolución a cliente"

    class PaymentMethod(models.TextChoices):
        CASH     = "cash",      "Efectivo"
        TRANSFER = "transfer",  "Transferencia"
        DEBIT    = "debit",     "Tarjeta Débito"
        CREDIT   = "credit",    "Tarjeta Crédito"
        NEQUI    = "nequi",     "Nequi"
        DAVIPLATA = "daviplata", "Daviplata"
        OTHER    = "other",     "Otro"

    session        = models.ForeignKey(CashSession, on_delete=models.PROTECT, related_name="movements")
    type           = models.CharField(max_length=10, choices=MovementType.choices)
    amount         = models.DecimalField(max_digits=12, decimal_places=2)
    description    = models.CharField(max_length=255)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    reference_id   = models.PositiveIntegerField(null=True, blank=True)
    created_by     = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_type_display()} ${self.amount} — {self.session.date}"
