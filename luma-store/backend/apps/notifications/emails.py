"""
apps/notifications/emails.py
────────────────────────────
Módulo de notificaciones por email para LUMA Store.

Diseño:
  - Silencioso: nunca lanza excepciones hacia el llamador.
    Si el SMTP falla, se registra en el logger y la operación continúa.
  - Condicional: sin EMAIL_HOST_USER / EMAIL_HOST_PASSWORD en Railway
    → EMAIL_BACKEND = console (imprime en terminal; cero configuración en dev).
  - Brandable: usa StoreConfig.get_config() para nombre, color y WhatsApp
    de la tienda, de modo que cada cliente tiene sus propios emails.

Uso típico (dentro de una vista con transaction.atomic):

    from apps.notifications.emails import send_order_confirmation
    transaction.on_commit(lambda: send_order_confirmation(order))

Usar transaction.on_commit garantiza que el email solo se envía si la
transacción confirma exitosamente — nunca para pedidos que luego se revirtieron.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# ── Metadatos de estado ───────────────────────────────────────────────────────
# Estados que merecen notificación al cliente. Los demás ('new', 'in_progress')
# son internos del flujo de trabajo y no son útiles para el comprador.
_NOTIFY_STATUSES = frozenset({"confirmed", "preparing", "shipped", "delivered", "cancelled"})

_STATUS_META = {
    "confirmed": (
        "✅", "Pedido confirmado",
        "Tu pedido está confirmado. ¡Pronto comenzaremos a prepararlo para ti!",
    ),
    "preparing": (
        "📦", "Preparando tu pedido",
        "¡Estamos empacando tu pedido con mucho cuidado!",
    ),
    "shipped": (
        "🚚", "Tu pedido va en camino",
        "Tu pedido fue enviado. Pronto estará en tus manos.",
    ),
    "delivered": (
        "🎉", "¡Pedido entregado!",
        "Tu pedido fue entregado. ¡Gracias por confiar en nosotros!",
    ),
    "cancelled": (
        "❌", "Pedido cancelado",
        "Tu pedido fue cancelado. Si tienes alguna pregunta, estamos para ayudarte.",
    ),
}


# ── Helpers privados ──────────────────────────────────────────────────────────

def _store_context() -> dict:
    """
    Retorna el contexto base con la configuración de la tienda.
    Si la DB no está disponible, cae a los valores de settings.py.
    """
    try:
        from apps.users.models import StoreConfig
        return {"config": StoreConfig.get_config()}
    except Exception:
        # Fallback para entornos de prueba que no tienen la tabla aún
        class _Fallback:
            name          = getattr(settings, "STORE_NAME",          "Mi Tienda")
            primary_color = getattr(settings, "STORE_PRIMARY_COLOR", "#2E86C1")
            whatsapp      = getattr(settings, "STORE_WHATSAPP",      "")
        return {"config": _Fallback()}


def _send(*, subject: str, html_template: str, txt_template: str,
          recipient: str, context: dict) -> None:
    """
    Renderiza las plantillas y envía el email.
    Captura cualquier excepción y la registra sin relanzarla.
    """
    try:
        html_body = render_to_string(html_template, context)
        text_body = render_to_string(txt_template,  context)
        send_mail(
            subject=subject,
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_body,
            fail_silently=False,    # Queremos el error en el logger
        )
        logger.info("Email '%s' enviado a %s", subject, recipient)
    except Exception as exc:
        logger.warning("Email no enviado — %s → %s: %s", subject, recipient, exc)


# ── API pública ───────────────────────────────────────────────────────────────

def send_order_confirmation(order) -> None:
    """
    Envía la confirmación de pedido al cliente.

    Condiciones para enviar:
      - order.customer existe y tiene email.
    """
    customer = getattr(order, "customer", None)
    if not customer or not getattr(customer, "email", ""):
        return

    ctx = _store_context()
    ctx.update({
        "order":    order,
        "customer": customer,
        "items":    order.items.select_related("variant__product").all(),
    })

    _send(
        subject=f"Pedido recibido {order.number} — {ctx['config'].name}",
        html_template="email/order_confirmation.html",
        txt_template="email/order_confirmation.txt",
        recipient=customer.email,
        context=ctx,
    )


def send_order_status_update(order, new_status: str) -> None:
    """
    Notifica al cliente cuando el estado de su pedido cambia a uno relevante.

    Estados que generan notificación: confirmed, preparing, shipped,
    delivered, cancelled.

    Estados que NO generan notificación (flujo interno): new, in_progress.
    """
    if new_status not in _NOTIFY_STATUSES:
        return

    customer = getattr(order, "customer", None)
    if not customer or not getattr(customer, "email", ""):
        return

    emoji, title, description = _STATUS_META.get(
        new_status,
        ("📬", "Actualización de pedido", "El estado de tu pedido fue actualizado."),
    )

    ctx = _store_context()
    ctx.update({
        "order":       order,
        "customer":    customer,
        "new_status":  new_status,
        "emoji":       emoji,
        "title":       title,
        "description": description,
    })

    _send(
        subject=f"{emoji} {title} — Pedido {order.number}",
        html_template="email/order_status_update.html",
        txt_template="email/order_status_update.txt",
        recipient=customer.email,
        context=ctx,
    )
