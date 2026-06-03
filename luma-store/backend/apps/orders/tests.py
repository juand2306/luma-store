from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.models import Customer
from apps.inventory.models import Category, Product, ProductVariant
from apps.sales.models import Sale
from .models import Order, OrderItem, OrderStatusHistory, PurchaseOrder
from .views import generate_order_number, generate_purchase_number

User = get_user_model()


def _auth(client, user):
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")


def _make_product(name="Camiseta", price=50000, stock=10):
    cat = Category.objects.first() or Category.objects.create(name="Ropa")
    # is_visible=True is required for StoreOrderCreateSerializer.validate_items()
    product = Product.objects.create(name=name, price=price, category=cat, is_visible=True)
    variant = ProductVariant.objects.create(product=product, size="M", color="Azul", stock=stock)
    return product, variant


def _make_admin(username="admin_orders"):
    return User.objects.create_user(username=username, password="pass", role="admin")


# ─────────────────────────────────────────────────────────────
#  generate_order_number()
# ─────────────────────────────────────────────────────────────

class OrderNumberTest(APITestCase):
    """generate_order_number() debe usar el campo 'number', no el id."""

    def setUp(self):
        Order.objects.all().delete()

    def test_first_number_is_ped_00001(self):
        number = generate_order_number()
        self.assertEqual(number, "PED-00001")

    def test_increments_from_last_number_field(self):
        """Crea un pedido con number PED-00005 y verifica que el siguiente sea PED-00006."""
        Order.objects.create(number="PED-00005", subtotal=50000, total=50000)
        next_num = generate_order_number()
        self.assertEqual(next_num, "PED-00006")

    def test_format_starts_with_ped(self):
        number = generate_order_number()
        self.assertTrue(number.startswith("PED-"))
        self.assertEqual(len(number), 9)  # "PED-00001" = 9 chars


# ─────────────────────────────────────────────────────────────
#  StoreOrderCreateView (AllowAny)
# ─────────────────────────────────────────────────────────────

class PublicOrderCreateTest(APITestCase):
    """POST /api/v1/store/orders/ — sin autenticación."""

    URL = "/api/v1/store/orders/"

    def setUp(self):
        _, self.variant = _make_product(stock=5)

    def _payload(self, qty=1):
        return {
            "customer_name": "Juan Pérez",
            "customer_phone": "3001234567",
            "items": [{"variant_id": self.variant.id, "quantity": qty}],
        }

    def test_create_order_no_auth_returns_201(self):
        resp = self.client.post(self.URL, self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_created_order_has_status_new(self):
        resp = self.client.post(self.URL, self._payload(), format="json")
        self.assertEqual(resp.data["status"], "new")

    def test_order_number_starts_with_ped(self):
        resp = self.client.post(self.URL, self._payload(), format="json")
        self.assertTrue(resp.data["number"].startswith("PED-"))

    def test_order_status_history_created_with_new(self):
        resp = self.client.post(self.URL, self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        history = OrderStatusHistory.objects.filter(
            order_id=resp.data["id"], status="new"
        )
        self.assertTrue(history.exists())

    def test_stock_check_quantity_exceeds_stock_returns_400(self):
        resp = self.client.post(self.URL, self._payload(qty=99), format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_items_are_created_correctly(self):
        resp = self.client.post(self.URL, self._payload(qty=2), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get(number=resp.data["number"])
        self.assertEqual(order.items.count(), 1)
        item = order.items.first()
        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.variant_id, self.variant.id)

    def test_order_create_links_customer_record(self):
        """Crear un pedido con teléfono debe crear y vincular un Customer."""
        Customer.objects.all().delete()
        resp = self.client.post(self.URL, self._payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.count(), 1)
        order = Order.objects.get(number=resp.data["number"])
        self.assertIsNotNone(order.customer_id)
        self.assertEqual(order.customer.phone, "3001234567")

    def test_second_order_same_phone_reuses_customer(self):
        """Dos pedidos del mismo teléfono deben compartir el mismo Customer."""
        Customer.objects.all().delete()
        self.client.post(self.URL, self._payload(), format="json")
        self.client.post(self.URL, self._payload(), format="json")
        self.assertEqual(Customer.objects.count(), 1)
        orders = Order.objects.all()
        customer_ids = set(o.customer_id for o in orders)
        self.assertEqual(len(customer_ids), 1)  # mismo FK en ambos pedidos

    def test_order_without_phone_has_no_customer(self):
        """Un pedido sin teléfono NO debe crear registro de Cliente."""
        Customer.objects.all().delete()
        payload = {
            "customer_name": "Anónimo",
            "customer_phone": "",
            "items": [{"variant_id": self.variant.id, "quantity": 1}],
        }
        resp = self.client.post(self.URL, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.count(), 0)
        order = Order.objects.get(number=resp.data["number"])
        self.assertIsNone(order.customer_id)


# ─────────────────────────────────────────────────────────────
#  OrderViewSet (IsOwnerOrAdmin)
# ─────────────────────────────────────────────────────────────

class OrderAdminTest(APITestCase):
    """Gestión de pedidos desde el panel de administración."""

    LIST_URL = "/api/v1/orders/"

    def setUp(self):
        self.admin = _make_admin()
        _auth(self.client, self.admin)
        _, self.variant = _make_product(stock=10)
        self.order = Order.objects.create(
            number="PED-00020",
            customer_name="Test Cliente",
            subtotal=50000,
            total=50000,
            status="new",
        )
        OrderItem.objects.create(
            order=self.order,
            variant=self.variant,
            quantity=1,
            unit_price=50000,
            subtotal=50000,
        )

    def _detail_url(self):
        return f"{self.LIST_URL}{self.order.id}/"

    def test_list_orders_requires_auth(self):
        self.client.credentials()
        resp = self.client.get(self.LIST_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_authenticated_admin_can_list_orders(self):
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_patch_status_creates_history_entry(self):
        resp = self.client.patch(self._detail_url(), {"status": "confirmed"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(
            OrderStatusHistory.objects.filter(order=self.order, status="confirmed").exists()
        )

    def test_update_to_delivered_creates_sale(self):
        resp = self.client.patch(
            self._detail_url(),
            {"status": "delivered", "payment_method": "cash"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(Sale.objects.filter(order=self.order).exists())

    def test_fulfill_order_propagates_customer_to_sale(self):
        """Al marcar como entregado, la Sale debe heredar el Customer del pedido."""
        customer = Customer.objects.create(name="Cliente Test", phone="3001111111")
        self.order.customer = customer
        self.order.save(update_fields=["customer"])

        self.client.patch(
            self._detail_url(),
            {"status": "delivered", "payment_method": "cash"},
            format="json",
        )
        sale = Sale.objects.get(order=self.order)
        self.assertEqual(sale.customer_id, customer.id)

    def test_no_create_via_api(self):
        """OrderViewSet no permite POST (http_method_names excluye 'post')."""
        resp = self.client.post(self.LIST_URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_status_filter(self):
        resp = self.client.get(f"{self.LIST_URL}?status=new")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for item in resp.data.get("results", resp.data):
            self.assertEqual(item["status"], "new")


# ─────────────────────────────────────────────────────────────
#  PurchaseOrderViewSet
# ─────────────────────────────────────────────────────────────

class PurchaseOrderTest(APITestCase):
    """CRUD de órdenes de compra."""

    LIST_URL = "/api/v1/orders/purchases/"

    def setUp(self):
        self.admin = _make_admin(username="admin_po")
        _auth(self.client, self.admin)
        _, self.variant = _make_product(stock=5)

    def _create_po(self, qty=10, po_status="pending"):
        return PurchaseOrder.objects.create(
            number=generate_purchase_number(),
            product_name="Camiseta Test",
            requested_qty=qty,
            status=po_status,
            created_by=self.admin,
        )

    def _create_po_with_variant(self, qty=10):
        return PurchaseOrder.objects.create(
            number=generate_purchase_number(),
            product_name=self.variant.product.name,
            variant=self.variant,
            requested_qty=qty,
            created_by=self.admin,
        )

    def test_create_purchase_order_returns_201(self):
        resp = self.client.post(
            self.LIST_URL,
            {"product_name": "Pantalón", "requested_qty": 5},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_purchase_order_number_starts_with_oc(self):
        resp = self.client.post(
            self.LIST_URL,
            {"product_name": "Pantalón", "requested_qty": 5},
            format="json",
        )
        self.assertTrue(resp.data["number"].startswith("OC-"))

    def test_receive_partial_qty_sets_status_partial(self):
        po = self._create_po(qty=10)
        url = f"{self.LIST_URL}{po.id}/receive/"
        resp = self.client.post(url, {"qty_received": 4, "payment_method": "", "note": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, "partial")
        self.assertEqual(po.received_qty, 4)

    def test_receive_partial_increments_variant_stock(self):
        po = self._create_po_with_variant(qty=10)
        initial_stock = self.variant.stock
        url = f"{self.LIST_URL}{po.id}/receive/"
        self.client.post(url, {"qty_received": 3, "payment_method": "", "note": ""}, format="json")
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, initial_stock + 3)

    def test_receive_full_qty_sets_status_received(self):
        po = self._create_po(qty=5)
        url = f"{self.LIST_URL}{po.id}/receive/"
        resp = self.client.post(url, {"qty_received": 5, "payment_method": "", "note": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, "received")

    def test_cancel_purchase_order(self):
        po = self._create_po()
        url = f"{self.LIST_URL}{po.id}/cancel/"
        resp = self.client.post(url, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, "cancelled")

    def test_delete_pending_po_returns_204(self):
        po = self._create_po()
        resp = self.client.delete(f"{self.LIST_URL}{po.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_delete_received_po_returns_400(self):
        po = self._create_po(po_status="received")
        resp = self.client.delete(f"{self.LIST_URL}{po.id}/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancel_already_received_returns_400(self):
        po = self._create_po(po_status="received")
        resp = self.client.post(f"{self.LIST_URL}{po.id}/cancel/", format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_receive_over_pending_qty_returns_400(self):
        po = self._create_po(qty=5)
        url = f"{self.LIST_URL}{po.id}/receive/"
        resp = self.client.post(url, {"qty_received": 10, "payment_method": "", "note": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────
#  PurchaseOrderViewSet — stats
# ─────────────────────────────────────────────────────────────

class PurchaseOrderStatsTest(APITestCase):
    """GET /api/v1/orders/purchases/stats/"""

    STATS_URL = "/api/v1/orders/purchases/stats/"

    def setUp(self):
        self.admin = _make_admin(username="admin_stats")
        _auth(self.client, self.admin)

    def test_stats_returns_200(self):
        resp = self.client.get(self.STATS_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_stats_has_required_keys(self):
        resp = self.client.get(self.STATS_URL)
        for key in ["pending", "partial", "received", "cancelled"]:
            self.assertIn(key, resp.data)

    def test_stats_counts_are_accurate(self):
        PurchaseOrder.objects.create(
            number="OC-STAT-01", product_name="Test", requested_qty=1, status="pending"
        )
        PurchaseOrder.objects.create(
            number="OC-STAT-02", product_name="Test", requested_qty=1, status="received"
        )
        resp = self.client.get(self.STATS_URL)
        self.assertGreaterEqual(resp.data["pending"], 1)
        self.assertGreaterEqual(resp.data["received"], 1)

    def test_unauthenticated_returns_401_or_403(self):
        self.client.credentials()
        resp = self.client.get(self.STATS_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
