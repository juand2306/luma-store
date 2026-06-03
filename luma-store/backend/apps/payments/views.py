"""
Endpoints de pasarela de pagos.

Actualmente en modo esqueleto — solo el webhook está expuesto pero
retorna 200 inmediatamente si PAYMENT_ENABLED=False.

Al activar un proveedor real, este webhook recibirá las notificaciones
del proveedor y actualizará el estado del pedido automáticamente.
"""

import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .providers import get_provider

logger = logging.getLogger(__name__)


class PaymentWebhookView(APIView):
    """
    POST /api/v1/payments/webhook/

    Recibe notificaciones de pago del proveedor (Wompi, Bold, etc.).
    Público — el proveedor llama directamente a este endpoint.

    Seguridad: la firma del webhook se valida ANTES de procesar cualquier dato.
    Si la firma no es válida, se rechaza con 400.
    """
    permission_classes = [AllowAny]
    authentication_classes = []   # Sin auth JWT — el proveedor no envía tokens

    def post(self, request):
        if not settings.PAYMENT_ENABLED:
            # Pagos desactivados — aceptamos el request pero no hacemos nada.
            # Esto evita errores si el proveedor hace un test de conectividad.
            return Response({"status": "payments_disabled"}, status=status.HTTP_200_OK)

        # 1. Validar firma del webhook
        provider  = get_provider()
        payload   = request.body
        signature = request.headers.get("X-Signature", "") or request.headers.get("X-Wompi-Signature", "")

        if not provider.verify_webhook(payload, signature):
            logger.warning("Webhook de pago rechazado: firma inválida")
            return Response({"error": "Firma inválida"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Procesar el evento
        # TODO: Implementar lógica según el proveedor activo:
        #   - Extraer el transaction_id y el nuevo status del payload
        #   - Buscar el Order relacionado
        #   - Actualizar order.payment_status
        #   - Si status == 'approved' → marcar pedido como confirmado
        #   - Si status == 'declined' → notificar al admin
        logger.info("Webhook de pago recibido: %s bytes", len(payload))

        return Response({"status": "ok"}, status=status.HTTP_200_OK)
