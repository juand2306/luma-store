from django.db import models


class Customer(models.Model):
    name       = models.CharField(max_length=150)
    phone      = models.CharField(max_length=20, blank=True)
    email      = models.EmailField(blank=True)
    note       = models.TextField(blank=True)
    points     = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["created_at"], name="customer_created_at_idx"),
        ]

    def __str__(self):
        return self.name

    @property
    def segment(self):
        """Calcula el segmento automáticamente según historial."""
        from django.utils import timezone
        from apps.sales.models import Sale

        now = timezone.now()
        last_90 = Sale.objects.filter(
            customer=self,
            created_at__gte=now - timezone.timedelta(days=90)
        )
        last_60 = last_90.filter(created_at__gte=now - timezone.timedelta(days=60))
        last_15 = last_90.filter(created_at__gte=now - timezone.timedelta(days=15))

        if last_15.count() == 1 and self.created_at >= now - timezone.timedelta(days=15):
            return "new"
        if last_60.count() > 3:
            return "frequent"
        if last_60.count() >= 1:
            return "regular"
        return "inactive"


class LoyaltyConfig(models.Model):
    """Configuración del sistema de puntos. Solo debe existir un registro (singleton)."""
    is_enabled        = models.BooleanField(default=False)
    points_per_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=1000,
        help_text="Cada X pesos = 1 punto"
    )
    value_per_point   = models.DecimalField(
        max_digits=10, decimal_places=2, default=50,
        help_text="Cada punto vale X pesos de descuento"
    )
    min_points_redeem = models.PositiveIntegerField(default=100)

    class Meta:
        verbose_name = "Loyalty Config"

    def __str__(self):
        return f"Fidelización — {'Activa' if self.is_enabled else 'Inactiva'}"
