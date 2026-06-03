"""
Pruebas del módulo de notificaciones por email.

Django configura automáticamente EMAIL_BACKEND = locmem al correr tests,
por lo que django.core.mail.outbox captura todos los emails enviados.
"""
from django.core import mail
from django.test import TestCase

from apps.customers.models import Customer
from apps.inventory.models import Category, Product, ProductVariant
from apps.orders.models import Order, OrderItem

from .emails import send_order_confirmation, send_order_status_update


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_order(email="ana@test.com", phone="3001234567") -> Order:
    """Crea un pedido con cliente, variante e ítem. Reutilizable en todos los tests."""
    cat     = Category.objects.first() or Category.objects.create(name="Ropa")
    product = Product.objects.create(
        name="Camiseta Test Email", price=50_000, category=cat, is_visible=True
    )
    variant = ProductVariant.objects.create(
        product=product, size="M", color="Azul", stock=10
    )
    customer = Customer.objects.create(
        name="Ana García", phone=phone, email=email
    )
    order = Order.objects.create(
        number=f"PED-MAIL-{Customer.objects.count()}",
        customer=customer,
        customer_name=customer.name,
        customer_phone=customer.phone,
        subtotal=50_000,
        total=50_000,
        status="new",
    )
    OrderItem.objects.create(
        order=order, variant=variant,
        quantity=2, unit_price=25_000, subtotal=50_000,
    )
    return order


# ── send_order_confirmation ───────────────────────────────────────────────────

class SendOrderConfirmationTest(TestCase):

    def test_envia_email_cuando_cliente_tiene_email(self):
        order = _make_order(email="ana@test.com")
        send_order_confirmation(order)
        self.assertEqual(len(mail.outbox), 1)

    def test_subject_contiene_numero_de_pedido(self):
        order = _make_order(email="ana@test.com")
        send_order_confirmation(order)
        self.assertIn(order.number, mail.outbox[0].subject)

    def test_destinatario_es_el_email_del_cliente(self):
        order = _make_order(email="ana@test.com")
        send_order_confirmation(order)
        self.assertIn("ana@test.com", mail.outbox[0].to)

    def test_email_tiene_version_html(self):
        """El email debe incluir una alternativa HTML además del texto plano."""
        order = _make_order(email="ana@test.com")
        send_order_confirmation(order)
        alternatives = mail.outbox[0].alternatives
        self.assertTrue(any(ct == "text/html" for _, ct in alternatives))

    def test_html_contiene_nombre_del_producto(self):
        order = _make_order(email="ana@test.com")
        send_order_confirmation(order)
        html_body = mail.outbox[0].alternatives[0][0]
        self.assertIn("Camiseta Test Email", html_body)

    def test_html_contiene_total_del_pedido(self):
        order = _make_order(email="ana@test.com")
        send_order_confirmation(order)
        html_body = mail.outbox[0].alternatives[0][0]
        self.assertIn("50", html_body)  # total $50.000

    def test_sin_email_no_envia(self):
        order = _make_order(email="")
        send_order_confirmation(order)
        self.assertEqual(len(mail.outbox), 0)

    def test_sin_cliente_no_envia(self):
        order = Order.objects.create(
            number="PED-ANON-01", subtotal=10_000, total=10_000, status="new"
        )
        send_order_confirmation(order)
        self.assertEqual(len(mail.outbox), 0)

    def test_no_lanza_excepcion_ante_cualquier_fallo(self):
        """El email nunca debe interrumpir el flujo del pedido."""
        order = _make_order(email="ana@test.com")
        # Forzamos un fallo poniendo un recipient inválido en el customer
        order.customer.email = "no-es-un-email-valido"
        try:
            send_order_confirmation(order)
        except Exception as exc:
            self.fail(f"send_order_confirmation() lanzó excepción inesperada: {exc}")


# ── send_order_status_update ──────────────────────────────────────────────────

class SendOrderStatusUpdateTest(TestCase):

    def _order(self):
        return _make_order(email="ana@test.com", phone=f"300{Customer.objects.count():07d}")

    # Estados que SÍ notifican
    def test_envia_para_confirmed(self):
        send_order_status_update(self._order(), "confirmed")
        self.assertEqual(len(mail.outbox), 1)

    def test_envia_para_preparing(self):
        send_order_status_update(self._order(), "preparing")
        self.assertEqual(len(mail.outbox), 1)

    def test_envia_para_shipped(self):
        send_order_status_update(self._order(), "shipped")
        self.assertEqual(len(mail.outbox), 1)

    def test_envia_para_delivered(self):
        send_order_status_update(self._order(), "delivered")
        self.assertEqual(len(mail.outbox), 1)

    def test_envia_para_cancelled(self):
        send_order_status_update(self._order(), "cancelled")
        self.assertEqual(len(mail.outbox), 1)

    # Estados que NO notifican (flujo interno)
    def test_no_envia_para_new(self):
        send_order_status_update(self._order(), "new")
        self.assertEqual(len(mail.outbox), 0)

    def test_no_envia_para_in_progress(self):
        send_order_status_update(self._order(), "in_progress")
        self.assertEqual(len(mail.outbox), 0)

    def test_no_envia_sin_email_de_cliente(self):
        order = _make_order(email="", phone="3199999999")
        send_order_status_update(order, "confirmed")
        self.assertEqual(len(mail.outbox), 0)

    def test_subject_contiene_numero_de_pedido(self):
        order = self._order()
        send_order_status_update(order, "confirmed")
        self.assertIn(order.number, mail.outbox[0].subject)

    def test_html_contiene_descripcion_del_estado(self):
        order = self._order()
        send_order_status_update(order, "confirmed")
        html_body = mail.outbox[0].alternatives[0][0]
        self.assertIn("confirmado", html_body.lower())

    def test_no_lanza_excepcion_ante_fallo(self):
        order = self._order()
        order.customer.email = "invalido"
        try:
            send_order_status_update(order, "confirmed")
        except Exception as exc:
            self.fail(f"send_order_status_update() lanzó excepción inesperada: {exc}")
