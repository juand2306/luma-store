import os
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Extiende el usuario de Django con el campo de rol.
    AbstractUser ya incluye: username, email, first_name, last_name,
    password, is_active, date_joined.
    """
    class Role(models.TextChoices):
        OWNER  = "owner",  "Dueño"
        ADMIN  = "admin",  "Administrador"
        SELLER = "seller", "Vendedor"
        VIEWER = "viewer", "Visor"

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.SELLER
    )

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"


class StoreConfig(models.Model):
    """
    Configuración global de la tienda. Singleton: solo existe un registro (pk=1).
    """
    name          = models.CharField(max_length=150)
    logo          = models.ImageField(upload_to="store/", null=True, blank=True)
    primary_color = models.CharField(max_length=7, default="#2E86C1")
    whatsapp      = models.CharField(max_length=20)
    address       = models.CharField(max_length=255, blank=True)
    schedule      = models.CharField(max_length=255, blank=True)
    return_policy = models.TextField(blank=True)
    banner_text   = models.CharField(max_length=300, blank=True)
    banner_image  = models.ImageField(upload_to="store/", null=True, blank=True)
    # Modos de pago habilitados — lista de objetos {key, label, enabled}
    payment_methods = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de métodos de pago configurados para la tienda."
    )
    # Plantillas de mensajes WhatsApp por estado de pedido
    msg_in_progress = models.TextField(
        default="Hola {nombre_cliente}, ya recibimos tu pedido #{numero_pedido} y lo estamos gestionando. 😊"
    )
    msg_confirmed   = models.TextField(
        default="¡{nombre_cliente}, tu pedido #{numero_pedido} está confirmado! Total: {total}. Te avisamos cuando esté listo."
    )
    msg_preparing   = models.TextField(
        default="Hola {nombre_cliente}, tu pedido #{numero_pedido} está siendo preparado. 📦"
    )
    msg_shipped     = models.TextField(
        default="¡{nombre_cliente}, tu pedido #{numero_pedido} fue enviado! Pronto lo recibirás. 🚚"
    )
    msg_delivered   = models.TextField(
        default="Hola {nombre_cliente}, tu pedido #{numero_pedido} fue entregado. ¡Gracias por tu compra! 🛍️"
    )
    msg_cancelled   = models.TextField(
        default="Hola {nombre_cliente}, lamentamos informarte que tu pedido #{numero_pedido} fue cancelado. Escríbenos para más información."
    )

    class Meta:
        verbose_name = "Configuración de Tienda"

    _CACHE_KEY = "store_config_singleton"
    _CACHE_TTL = 300  # 5 minutos

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        # Invalidar caché cuando la configuración cambia
        from django.core.cache import cache
        cache.delete(self._CACHE_KEY)

    @classmethod
    def get_config(cls):
        from django.core.cache import cache
        obj = cache.get(cls._CACHE_KEY)
        if obj is None:
            obj, _ = cls.objects.get_or_create(pk=1, defaults={
                "name": os.getenv("STORE_NAME", "Mi Tienda"),
                "whatsapp": os.getenv("STORE_WHATSAPP", ""),
                "primary_color": os.getenv("STORE_PRIMARY_COLOR", "#2E86C1"),
            })
            cache.set(cls._CACHE_KEY, obj, cls._CACHE_TTL)
        return obj

    def __str__(self):
        return f"Configuración: {self.name}"
