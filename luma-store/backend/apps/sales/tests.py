from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.users.models import User, StoreConfig
from apps.cash.models import CashSession, CashMovement
from apps.inventory.models import Product, ProductVariant
from apps.sales.models import Sale, SaleItem, Return


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_token(user):
    """Returns a JWT Bearer string for the given user."""
    token = RefreshToken.for_user(user)
    return f"Bearer {str(token.access_token)}"


def _open_session(user):
    """Creates (or returns) an open cash session for today."""
    return CashSession.objects.get_or_create(
        date=timezone.localdate(),
        defaults={"opening_amount": 100_000, "opened_by": user},
    )[0]


def _store_config(payment_methods=None):
    """Creates or updates the singleton StoreConfig."""
    config, _ = StoreConfig.objects.get_or_create(
        pk=1,
        defaults={"name": "Test Store", "whatsapp": ""},
    )
    if payment_methods is not None:
        config.payment_methods = payment_methods
        config.save()
    return config


def _product_and_variant(name="Test Product", price=50_000, stock=10):
    product = Product.objects.create(name=name, price=price, cost=20_000)
    variant = ProductVariant.objects.create(
        product=product, size="M", color="Negro", stock=stock
    )
    return product, variant


SALE_URL = "/api/v1/sales/"
RETURN_URL = "/api/v1/sales/returns/"
STATS_URL = "/api/v1/sales/stats/"


# ---------------------------------------------------------------------------
# SaleCreationTests
# ---------------------------------------------------------------------------

class SaleCreationTests(APITestCase):
    """Core creation flow — most critical test class."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", password="pass", role="owner"
        )
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.owner))

        _store_config(
            payment_methods=[{"key": "cash", "label": "Efectivo", "enabled": True}]
        )
        self.session = _open_session(self.owner)
        self.product, self.variant = _product_and_variant()

    def _sale_payload(self, quantity=3, payment_method="cash", extra=None):
        payload = {
            "items": [{"variant_id": self.variant.id, "quantity": quantity}],
            "payment_method": payment_method,
        }
        if extra:
            payload.update(extra)
        return payload

    # ------------------------------------------------------------------
    # No open cash session
    # ------------------------------------------------------------------
    def test_sale_without_open_session_returns_400(self):
        """Should reject sale creation when there is no open cash session."""
        self.session.status = "closed"
        self.session.save()

        response = self.client.post(SALE_URL, self._sale_payload(), format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("No hay caja abierta", response.data["detail"])

    # ------------------------------------------------------------------
    # Happy path — basic creation
    # ------------------------------------------------------------------
    def test_sale_with_open_session_returns_201(self):
        """Valid sale with open session should return 201."""
        response = self.client.post(SALE_URL, self._sale_payload(), format="json")

        self.assertEqual(response.status_code, 201)

    def test_sale_number_starts_with_VTA(self):
        """Created sale number must follow the VTA-XXXXX format."""
        response = self.client.post(SALE_URL, self._sale_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["number"].startswith("VTA-"))

    def test_sale_sold_by_is_authenticated_user(self):
        """sale.sold_by must be set to the user who made the request."""
        response = self.client.post(SALE_URL, self._sale_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        sale = Sale.objects.get(id=response.data["id"])
        self.assertEqual(sale.sold_by, self.owner)

    # ------------------------------------------------------------------
    # Stock decrement
    # ------------------------------------------------------------------
    def test_sale_decrements_variant_stock(self):
        """Variant stock must decrease by the sold quantity."""
        initial_stock = self.variant.stock  # 10
        sell_qty = 3

        self.client.post(SALE_URL, self._sale_payload(quantity=sell_qty), format="json")

        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, initial_stock - sell_qty)

    # ------------------------------------------------------------------
    # CashMovement income
    # ------------------------------------------------------------------
    def test_sale_creates_income_cash_movement(self):
        """A CashMovement of type 'income' must be created in the open session."""
        before_count = CashMovement.objects.filter(
            session=self.session, type=CashMovement.MovementType.INCOME
        ).count()

        response = self.client.post(SALE_URL, self._sale_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        after_count = CashMovement.objects.filter(
            session=self.session, type=CashMovement.MovementType.INCOME
        ).count()
        self.assertEqual(after_count, before_count + 1)

    # ------------------------------------------------------------------
    # Cash change calculation
    # ------------------------------------------------------------------
    def test_sale_with_cash_received_computes_cash_change(self):
        """cash_change must equal cash_received minus the sale total."""
        unit_price = float(self.variant.get_price())  # 50 000
        expected_total = unit_price * 3  # 150 000
        cash_given = expected_total + 10_000  # 160 000 — customer gives more

        payload = self._sale_payload(quantity=3, extra={"cash_received": cash_given})
        response = self.client.post(SALE_URL, payload, format="json")

        self.assertEqual(response.status_code, 201)
        sale = Sale.objects.get(id=response.data["id"])
        self.assertAlmostEqual(float(sale.cash_change), cash_given - expected_total, places=2)

    def test_sale_without_cash_received_has_no_change(self):
        """cash_change must be None when cash_received is not provided."""
        response = self.client.post(SALE_URL, self._sale_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        sale = Sale.objects.get(id=response.data["id"])
        self.assertIsNone(sale.cash_change)


# ---------------------------------------------------------------------------
# PaymentMethodValidationTests — regression for StoreConfig import fix
# ---------------------------------------------------------------------------

class PaymentMethodValidationTests(APITestCase):
    """Regression suite for the StoreConfig import fix in the serializer."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_pm", password="pass", role="owner"
        )
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.owner))

        # Configure a custom payment method ("nequi") in StoreConfig
        _store_config(
            payment_methods=[{"key": "nequi", "label": "Nequi", "enabled": True}]
        )
        _open_session(self.owner)
        self.product, self.variant = _product_and_variant(name="PM Product")

    def _payload(self, payment_method):
        return {
            "items": [{"variant_id": self.variant.id, "quantity": 1}],
            "payment_method": payment_method,
        }

    def test_custom_payment_method_from_store_config_accepted(self):
        """Payment method configured in StoreConfig (nequi) must be accepted."""
        response = self.client.post(SALE_URL, self._payload("nequi"), format="json")
        self.assertEqual(response.status_code, 201)

    def test_invalid_payment_method_returns_400(self):
        """Payment method not in StoreConfig must be rejected with 400."""
        response = self.client.post(SALE_URL, self._payload("invalid_method"), format="json")
        self.assertEqual(response.status_code, 400)

    def test_payment_method_alias_card_normalised_to_debit(self):
        """Legacy alias 'card' must be normalised and accepted if 'debit' is in config."""
        _store_config(
            payment_methods=[{"key": "debit", "label": "Débito", "enabled": True}]
        )
        response = self.client.post(SALE_URL, self._payload("card"), format="json")
        self.assertEqual(response.status_code, 201)


# ---------------------------------------------------------------------------
# StockValidationTests
# ---------------------------------------------------------------------------

class StockValidationTests(APITestCase):
    """Stock boundary validation in the serializer."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_stock", password="pass", role="owner"
        )
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.owner))
        _store_config(
            payment_methods=[{"key": "cash", "label": "Efectivo", "enabled": True}]
        )
        _open_session(self.owner)
        self.product, self.variant = _product_and_variant(name="Stock Product", stock=5)

    def _payload(self, quantity):
        return {
            "items": [{"variant_id": self.variant.id, "quantity": quantity}],
            "payment_method": "cash",
        }

    def test_quantity_exceeds_stock_returns_400(self):
        """Requesting more units than available stock must return 400."""
        response = self.client.post(SALE_URL, self._payload(self.variant.stock + 1), format="json")

        self.assertEqual(response.status_code, 400)

    def test_error_message_mentions_stock(self):
        """The 400 error must mention stock availability."""
        response = self.client.post(SALE_URL, self._payload(self.variant.stock + 1), format="json")

        # Error may be nested under 'items' or at root — check the whole response body
        error_text = str(response.data).lower()
        self.assertTrue(
            "stock" in error_text or "disponible" in error_text,
            msg=f"Expected stock message in error, got: {response.data}",
        )

    def test_quantity_equals_stock_boundary_returns_201(self):
        """Selling exactly the available stock (boundary) must succeed."""
        response = self.client.post(SALE_URL, self._payload(self.variant.stock), format="json")

        self.assertEqual(response.status_code, 201)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock, 0)


# ---------------------------------------------------------------------------
# SalePermissionsTests
# ---------------------------------------------------------------------------

class SalePermissionsTests(APITestCase):
    """Role-based queryset isolation."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_perm", password="pass", role="owner"
        )
        self.seller1 = User.objects.create_user(
            username="seller1", password="pass", role="seller"
        )
        self.seller2 = User.objects.create_user(
            username="seller2", password="pass", role="seller"
        )

        _store_config(
            payment_methods=[{"key": "cash", "label": "Efectivo", "enabled": True}]
        )
        session = _open_session(self.owner)
        product, variant = _product_and_variant(name="Perm Product", stock=100)

        # Create one sale per seller (directly in DB, bypassing the view)
        self.sale_seller1 = Sale.objects.create(
            number="VTA-99001",
            subtotal=50_000,
            total=50_000,
            payment_method="cash",
            sold_by=self.seller1,
            cash_session=session,
        )
        self.sale_seller2 = Sale.objects.create(
            number="VTA-99002",
            subtotal=50_000,
            total=50_000,
            payment_method="cash",
            sold_by=self.seller2,
            cash_session=session,
        )

    def test_owner_can_see_all_sales(self):
        """Owner/admin must see every sale in the system."""
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.owner))
        response = self.client.get(SALE_URL)

        self.assertEqual(response.status_code, 200)
        ids = [s["id"] for s in response.data["results"] if "id" in s] if "results" in response.data else [s["id"] for s in response.data]
        self.assertIn(self.sale_seller1.id, ids)
        self.assertIn(self.sale_seller2.id, ids)

    def test_seller_sees_only_own_sales(self):
        """Seller must not see another seller's sales."""
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.seller1))
        response = self.client.get(SALE_URL)

        self.assertEqual(response.status_code, 200)
        data = response.data.get("results", response.data)
        ids = [s["id"] for s in data]
        self.assertIn(self.sale_seller1.id, ids)
        self.assertNotIn(self.sale_seller2.id, ids)

    def test_seller_cannot_access_others_sale_detail(self):
        """Seller must not retrieve another seller's sale by ID."""
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.seller1))
        response = self.client.get(f"{SALE_URL}{self.sale_seller2.id}/")

        # Either 404 (filtered out) or 403 is acceptable
        self.assertIn(response.status_code, [403, 404])


# ---------------------------------------------------------------------------
# ReturnTests
# ---------------------------------------------------------------------------

class ReturnTests(APITestCase):
    """Return and swap flows."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_ret", password="pass", role="owner"
        )
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.owner))
        _store_config(
            payment_methods=[{"key": "cash", "label": "Efectivo", "enabled": True}]
        )
        self.session = _open_session(self.owner)
        self.product, self.returned_variant = _product_and_variant(
            name="Return Product", stock=5
        )
        # A second variant for swap tests (same product, different size)
        self.swapped_variant = ProductVariant.objects.create(
            product=self.product, size="L", color="Negro", stock=8
        )

        # Create a sale to reference
        self.sale = Sale.objects.create(
            number="VTA-88001",
            subtotal=50_000,
            total=50_000,
            payment_method="cash",
            sold_by=self.owner,
            cash_session=self.session,
        )

    def _return_payload(self):
        return {
            "type": "return",
            "reason": "size",
            "original_sale": self.sale.id,
            "returned_variant": self.returned_variant.id,
            "returned_quantity": 1,
            "returned_price": "50000.00",
        }

    def _swap_payload(self):
        return {
            "type": "swap",
            "reason": "size",
            "original_sale": self.sale.id,
            "returned_variant": self.returned_variant.id,
            "returned_quantity": 1,
            "returned_price": "50000.00",
            "swapped_variant": self.swapped_variant.id,
            "swapped_quantity": 1,
            "swapped_price": "50000.00",
        }

    # ------------------------------------------------------------------
    # Return flow
    # ------------------------------------------------------------------
    def test_return_creates_201(self):
        """POST a valid return must respond with 201."""
        response = self.client.post(RETURN_URL, self._return_payload(), format="json")
        self.assertEqual(response.status_code, 201)

    def test_return_increments_returned_variant_stock(self):
        """Returning an item must add its quantity back to variant stock."""
        initial_stock = self.returned_variant.stock  # 5

        self.client.post(RETURN_URL, self._return_payload(), format="json")

        self.returned_variant.refresh_from_db()
        self.assertEqual(self.returned_variant.stock, initial_stock + 1)

    def test_return_creates_refund_cash_movement(self):
        """A return must create a CashMovement of type 'refund'."""
        before_count = CashMovement.objects.filter(
            session=self.session, type=CashMovement.MovementType.REFUND
        ).count()

        response = self.client.post(RETURN_URL, self._return_payload(), format="json")

        self.assertEqual(response.status_code, 201)
        after_count = CashMovement.objects.filter(
            session=self.session, type=CashMovement.MovementType.REFUND
        ).count()
        self.assertGreater(after_count, before_count)

    def test_return_without_open_session_returns_400(self):
        """Return must be rejected if there is no open cash session."""
        self.session.status = "closed"
        self.session.save()

        response = self.client.post(RETURN_URL, self._return_payload(), format="json")

        self.assertEqual(response.status_code, 400)

    # ------------------------------------------------------------------
    # Swap flow
    # ------------------------------------------------------------------
    def test_swap_creates_201(self):
        """POST a valid swap must respond with 201."""
        response = self.client.post(RETURN_URL, self._swap_payload(), format="json")
        self.assertEqual(response.status_code, 201)

    def test_swap_increments_returned_variant_stock(self):
        """Swap must increase stock of the variant that came back."""
        initial = self.returned_variant.stock

        self.client.post(RETURN_URL, self._swap_payload(), format="json")

        self.returned_variant.refresh_from_db()
        self.assertEqual(self.returned_variant.stock, initial + 1)

    def test_swap_decrements_swapped_variant_stock(self):
        """Swap must decrease stock of the variant that goes out."""
        initial = self.swapped_variant.stock

        self.client.post(RETURN_URL, self._swap_payload(), format="json")

        self.swapped_variant.refresh_from_db()
        self.assertEqual(self.swapped_variant.stock, initial - 1)

    def test_swap_without_swapped_variant_returns_400(self):
        """A swap without the replacement variant must be rejected."""
        payload = self._swap_payload()
        del payload["swapped_variant"]

        response = self.client.post(RETURN_URL, payload, format="json")

        self.assertEqual(response.status_code, 400)

    def test_swap_insufficient_swapped_stock_returns_400(self):
        """Swap must fail if the replacement variant has insufficient stock."""
        self.swapped_variant.stock = 0
        self.swapped_variant.save()

        response = self.client.post(RETURN_URL, self._swap_payload(), format="json")

        self.assertEqual(response.status_code, 400)


# ---------------------------------------------------------------------------
# SaleStatsTest
# ---------------------------------------------------------------------------

class SaleStatsTest(APITestCase):
    """Aggregated stats endpoint."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_stats", password="pass", role="owner"
        )
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(self.owner))
        _store_config(
            payment_methods=[{"key": "cash", "label": "Efectivo", "enabled": True}]
        )
        session = _open_session(self.owner)

        Sale.objects.create(
            number="VTA-77001",
            subtotal=50_000,
            total=50_000,
            payment_method="cash",
            sold_by=self.owner,
            cash_session=session,
        )
        Sale.objects.create(
            number="VTA-77002",
            subtotal=30_000,
            total=30_000,
            payment_method="cash",
            sold_by=self.owner,
            cash_session=session,
        )

    def test_stats_endpoint_returns_200(self):
        """GET /api/v1/sales/stats/ must respond with 200."""
        response = self.client.get(STATS_URL)
        self.assertEqual(response.status_code, 200)

    def test_stats_contains_required_keys(self):
        """Stats response must include total_revenue, avg_ticket, and count."""
        response = self.client.get(STATS_URL)

        self.assertIn("total_revenue", response.data)
        self.assertIn("avg_ticket", response.data)
        self.assertIn("count", response.data)

    def test_stats_total_revenue_aggregates_correctly(self):
        """total_revenue must equal the sum of all sale totals."""
        response = self.client.get(STATS_URL)

        self.assertAlmostEqual(response.data["total_revenue"], 80_000, places=2)

    def test_stats_count_reflects_number_of_sales(self):
        """count must equal the number of sales visible to the user."""
        response = self.client.get(STATS_URL)

        self.assertEqual(response.data["count"], 2)

    def test_stats_avg_ticket_is_correct(self):
        """avg_ticket must be the arithmetic mean of all sale totals."""
        response = self.client.get(STATS_URL)

        self.assertAlmostEqual(response.data["avg_ticket"], 40_000, places=2)

    def test_stats_empty_returns_zeros(self):
        """Stats on an empty queryset must return zeros, not errors."""
        Sale.objects.all().delete()
        response = self.client.get(STATS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_revenue"], 0)
        self.assertEqual(response.data["count"], 0)

    def test_seller_stats_scoped_to_own_sales(self):
        """Seller stats must only aggregate their own sales."""
        seller = User.objects.create_user(
            username="seller_stats", password="pass", role="seller"
        )
        self.client.credentials(HTTP_AUTHORIZATION=_make_token(seller))
        response = self.client.get(STATS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["total_revenue"], 0)
