"""
LUMA Store — Esqueleto de pasarela de pagos.

Arquitectura basada en el patrón Strategy:
  - PaymentProvider: contrato (clase abstracta) que todos los proveedores deben cumplir.
  - DummyProvider:   implementación actual (no cobra nada, solo simula).
  - WompiProvider:   esqueleto listo para implementar (Bancolombia Pay — Colombia).
  - BoldProvider:    esqueleto listo para implementar (Bold — Colombia).

Para activar un proveedor real:
  1. Cambiar PAYMENT_ENABLED=True en .env
  2. Cambiar PAYMENT_PROVIDER=wompi (o bold / stripe)
  3. Agregar PAYMENT_PUBLIC_KEY y PAYMENT_PRIVATE_KEY
  4. Implementar los métodos del proveedor elegido (marcados con TODO)
  5. Instalar el SDK si aplica (ej: pip install wompi-py)

Referencia Colombia:
  Wompi: https://docs.wompi.co  — sin costo fijo, ~2.9% + IVA por transacción
  Bold:  https://docs.bold.co   — sin costo fijo, ~2.9% + IVA por transacción
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from django.conf import settings


# ── Tipos de datos compartidos ────────────────────────────────────────────────

@dataclass
class PaymentIntent:
    """Resultado de crear un intento de pago."""
    provider_id: str          # ID generado por el proveedor
    redirect_url: str         # URL a donde redirigir al cliente para pagar
    status: str               # pending | approved | declined | error
    raw: dict                 # Respuesta completa del proveedor (para logs)


@dataclass
class PaymentStatus:
    """Resultado de verificar el estado de un pago."""
    provider_id: str
    status: str               # pending | approved | declined | error
    amount: Optional[int]     # Monto en centavos (o None si no disponible)
    raw: dict


# ── Contrato base ─────────────────────────────────────────────────────────────

class PaymentProvider(ABC):
    """
    Interfaz que todo proveedor de pagos debe implementar.
    Si en el futuro se agrega un proveedor nuevo, solo hay que crear
    una subclase de esta clase y registrarla en get_provider().
    """

    @abstractmethod
    def create_payment(
        self,
        order_id: str,
        amount_cop: int,
        customer_email: str,
        description: str,
        redirect_url: str,
    ) -> PaymentIntent:
        """
        Crea un intento de pago en el proveedor.

        Args:
            order_id:       Número del pedido (ej: 'PED-00042')
            amount_cop:     Monto en pesos colombianos (entero, sin decimales)
            customer_email: Email del cliente
            description:    Descripción corta del pedido
            redirect_url:   URL a donde el proveedor redirige tras el pago

        Returns:
            PaymentIntent con la URL de pago y el ID del proveedor
        """
        ...

    @abstractmethod
    def verify_payment(self, provider_id: str) -> PaymentStatus:
        """
        Consulta el estado actual de un pago por su ID de proveedor.
        Usado al recibir el webhook o al redirigir de vuelta al cliente.
        """
        ...

    @abstractmethod
    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """
        Valida que el webhook recibido sea auténtico (firmado por el proveedor).
        Debe retornar True si la firma es válida, False si no.
        IMPORTANTE: nunca procesar un webhook sin validar la firma primero.
        """
        ...


# ── Proveedor dummy (activo cuando PAYMENT_ENABLED=False) ────────────────────

class DummyProvider(PaymentProvider):
    """
    Proveedor simulado. No realiza cobros reales.
    Activo por defecto mientras PAYMENT_ENABLED=False.
    Retorna siempre status='pending' para no bloquear el flujo de pedidos.
    """

    def create_payment(self, order_id, amount_cop, customer_email, description, redirect_url):
        return PaymentIntent(
            provider_id=f"dummy-{order_id}",
            redirect_url=redirect_url,
            status="pending",
            raw={"note": "DummyProvider — pagos desactivados"},
        )

    def verify_payment(self, provider_id):
        return PaymentStatus(
            provider_id=provider_id,
            status="pending",
            amount=None,
            raw={"note": "DummyProvider — pagos desactivados"},
        )

    def verify_webhook(self, payload, signature):
        return True  # En modo dummy, acepta todo


# ── Esqueleto Wompi (Bancolombia Pay — Colombia) ──────────────────────────────

class WompiProvider(PaymentProvider):
    """
    Proveedor Wompi (Bancolombia Pay).
    Documentación: https://docs.wompi.co

    Instalación cuando se active:
      pip install requests   (ya incluido como dependencia de Django)

    Costos: sin costo fijo mensual. ~2.9% + IVA por transacción exitosa.
    """

    BASE_URL = "https://production.wompi.co/v1"
    SANDBOX_URL = "https://sandbox.wompi.co/v1"

    def __init__(self):
        self.public_key  = settings.PAYMENT_PUBLIC_KEY
        self.private_key = settings.PAYMENT_PRIVATE_KEY
        self.base_url    = self.SANDBOX_URL if settings.DEBUG else self.BASE_URL

    def create_payment(self, order_id, amount_cop, customer_email, description, redirect_url):
        # TODO: Implementar llamada a Wompi API
        # Referencia: https://docs.wompi.co/docs/colombia/widget-checkout
        # 1. Generar firma de integridad: SHA256(reference + amount_in_cents + currency + integrity_secret)
        # 2. Retornar redirect_url hacia el widget de Wompi con los parámetros
        raise NotImplementedError("WompiProvider.create_payment no implementado aún")

    def verify_payment(self, provider_id):
        # TODO: GET {base_url}/transactions/{provider_id}
        # Headers: Authorization: Bearer {private_key}
        raise NotImplementedError("WompiProvider.verify_payment no implementado aún")

    def verify_webhook(self, payload, signature):
        # TODO: Validar firma HMAC-SHA256
        # Referencia: https://docs.wompi.co/docs/colombia/eventos
        raise NotImplementedError("WompiProvider.verify_webhook no implementado aún")


# ── Esqueleto Bold (Colombia) ─────────────────────────────────────────────────

class BoldProvider(PaymentProvider):
    """
    Proveedor Bold.
    Documentación: https://docs.bold.co

    Costos: sin costo fijo mensual. ~2.9% + IVA por transacción exitosa.
    """

    def __init__(self):
        self.public_key  = settings.PAYMENT_PUBLIC_KEY
        self.private_key = settings.PAYMENT_PRIVATE_KEY

    def create_payment(self, order_id, amount_cop, customer_email, description, redirect_url):
        # TODO: Implementar integración Bold
        # Referencia: https://docs.bold.co/docs/crear-un-link-de-pago
        raise NotImplementedError("BoldProvider.create_payment no implementado aún")

    def verify_payment(self, provider_id):
        # TODO: Consultar estado del pago en Bold API
        raise NotImplementedError("BoldProvider.verify_payment no implementado aún")

    def verify_webhook(self, payload, signature):
        # TODO: Validar firma del webhook Bold
        raise NotImplementedError("BoldProvider.verify_webhook no implementado aún")


# ── Factory — selecciona el proveedor según settings ─────────────────────────

def get_provider() -> PaymentProvider:
    """
    Retorna el proveedor de pagos activo según la configuración.
    Usar esta función en las vistas — nunca instanciar el proveedor directamente.

    Ejemplo de uso:
        from apps.payments.providers import get_provider

        provider = get_provider()
        intent = provider.create_payment(
            order_id="PED-00042",
            amount_cop=85000,
            customer_email="cliente@email.com",
            description="Pedido PED-00042 - LUMA Store",
            redirect_url="https://mitienda.com/pedido/confirmacion/",
        )
    """
    if not settings.PAYMENT_ENABLED:
        return DummyProvider()

    providers = {
        "wompi": WompiProvider,
        "bold":  BoldProvider,
    }

    provider_cls = providers.get(settings.PAYMENT_PROVIDER.lower())
    if not provider_cls:
        raise ValueError(
            f"PAYMENT_PROVIDER='{settings.PAYMENT_PROVIDER}' no es válido. "
            f"Opciones disponibles: {list(providers.keys())}"
        )

    return provider_cls()
