from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Customer, LoyaltyConfig

User = get_user_model()


def _auth(client, user):
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")


def _make_user(username, role):
    return User.objects.create_user(username=username, password="pass", role=role)


def _make_customer(name="Ana García", phone="3001234567", email="ana@example.com"):
    return Customer.objects.create(name=name, phone=phone, email=email)


# ─────────────────────────────────────────────────────────────
#  CustomerViewSet — CRUD
# ─────────────────────────────────────────────────────────────

class CustomerCRUDTest(APITestCase):
    """Operaciones básicas de clientes."""

    LIST_URL = "/api/v1/customers/"

    def setUp(self):
        self.admin = _make_user("admin_cust", "admin")
        self.seller = _make_user("seller_cust", "seller")

    def test_create_customer_returns_201(self):
        _auth(self.client, self.admin)
        resp = self.client.post(
            self.LIST_URL,
            {"name": "Carlos López", "phone": "3109876543", "email": "carlos@test.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", resp.data)
        self.assertEqual(resp.data["name"], "Carlos López")

    def test_create_response_has_segment_and_total_purchases(self):
        _auth(self.client, self.admin)
        resp = self.client.post(
            self.LIST_URL,
            {"name": "María Test", "phone": "3110000000", "email": "maria@test.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # El serializer expone estos campos calculados
        self.assertIn("segment", resp.data)
        self.assertIn("total_purchases", resp.data)

    def test_list_returns_200_paginated(self):
        _auth(self.client, self.admin)
        _make_customer(name="Cliente A", phone="3111111111", email="a@test.com")
        _make_customer(name="Cliente B", phone="3122222222", email="b@test.com")
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # DRF paginación: results key
        results = resp.data.get("results", resp.data)
        self.assertGreaterEqual(len(results), 2)

    def test_patch_customer_returns_200(self):
        _auth(self.client, self.admin)
        customer = _make_customer(name="Antes", phone="3130000001", email="antes@test.com")
        resp = self.client.patch(
            f"{self.LIST_URL}{customer.id}/",
            {"name": "Después"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.name, "Después")

    def test_seller_can_create(self):
        _auth(self.client, self.seller)
        resp = self.client.post(
            self.LIST_URL,
            {"name": "Seller Cliente", "phone": "3140000001", "email": "sc@test.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_seller_can_list(self):
        _auth(self.client, self.seller)
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_seller_cannot_delete(self):
        _auth(self.client, self.seller)
        customer = _make_customer(name="Para Borrar", phone="3150000001", email="del@test.com")
        resp = self.client.delete(f"{self.LIST_URL}{customer.id}/")
        self.assertIn(resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED])

    def test_unauthenticated_cannot_list(self):
        resp = self.client.get(self.LIST_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ─────────────────────────────────────────────────────────────
#  CustomerViewSet — búsqueda (regresión: email search fix)
# ─────────────────────────────────────────────────────────────

class CustomerSearchTest(APITestCase):
    """Regresión: la búsqueda debe incluir email (fix aplicado en views.py)."""

    LIST_URL = "/api/v1/customers/"

    def setUp(self):
        self.admin = _make_user("admin_search", "admin")
        _auth(self.client, self.admin)
        self.customer = Customer.objects.create(
            name="TestName Apellido",
            phone="3001234567",
            email="test@example.com",
        )

    def test_search_by_email_finds_customer(self):
        resp = self.client.get(f"{self.LIST_URL}?search=test@example.com")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        ids = [c["id"] for c in results]
        self.assertIn(self.customer.id, ids, "La búsqueda por email no encontró al cliente")

    def test_search_by_name_finds_customer(self):
        resp = self.client.get(f"{self.LIST_URL}?search=TestName")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        ids = [c["id"] for c in results]
        self.assertIn(self.customer.id, ids)

    def test_search_by_phone_finds_customer(self):
        resp = self.client.get(f"{self.LIST_URL}?search=3001234567")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        ids = [c["id"] for c in results]
        self.assertIn(self.customer.id, ids)

    def test_search_no_match_returns_empty(self):
        resp = self.client.get(f"{self.LIST_URL}?search=zzz_no_match_zzz")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertEqual(len(results), 0)


# ─────────────────────────────────────────────────────────────
#  CustomerViewSet — stats action
# ─────────────────────────────────────────────────────────────

class CustomerStatsTest(APITestCase):
    """GET /api/v1/customers/stats/"""

    STATS_URL = "/api/v1/customers/stats/"

    def setUp(self):
        self.admin = _make_user("admin_cstats", "admin")
        _auth(self.client, self.admin)

    def test_stats_returns_200(self):
        resp = self.client.get(self.STATS_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_stats_has_required_keys(self):
        resp = self.client.get(self.STATS_URL)
        for key in ["total_count", "total_revenue", "total_points"]:
            self.assertIn(key, resp.data)

    def test_stats_total_count_reflects_db(self):
        Customer.objects.all().delete()
        Customer.objects.create(name="Solo Uno", phone="3160000001")
        resp = self.client.get(self.STATS_URL)
        self.assertEqual(resp.data["total_count"], 1)

    def test_unauthenticated_returns_403_or_401(self):
        self.client.credentials()
        resp = self.client.get(self.STATS_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ─────────────────────────────────────────────────────────────
#  LoyaltyConfigView
# ─────────────────────────────────────────────────────────────

class LoyaltyConfigTest(APITestCase):
    """GET/PATCH /api/v1/customers/loyalty/"""

    LOYALTY_URL = "/api/v1/customers/loyalty/"

    def setUp(self):
        self.owner = _make_user("owner_loyalty", "owner")
        self.seller = _make_user("seller_loyalty", "seller")

    def test_get_loyalty_config_returns_200(self):
        _auth(self.client, self.owner)
        resp = self.client.get(self.LOYALTY_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_get_has_required_fields(self):
        _auth(self.client, self.owner)
        resp = self.client.get(self.LOYALTY_URL)
        for key in ["is_enabled", "points_per_amount", "value_per_point", "min_points_redeem"]:
            self.assertIn(key, resp.data)

    def test_patch_is_enabled_saves_correctly(self):
        _auth(self.client, self.owner)
        resp = self.client.patch(self.LOYALTY_URL, {"is_enabled": True}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["is_enabled"])
        config = LoyaltyConfig.objects.get(pk=1)
        self.assertTrue(config.is_enabled)

    def test_seller_cannot_access_loyalty_config(self):
        _auth(self.client, self.seller)
        resp = self.client.get(self.LOYALTY_URL)
        self.assertIn(resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED])

    def test_unauthenticated_cannot_access(self):
        resp = self.client.get(self.LOYALTY_URL)
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ─────────────────────────────────────────────────────────────
#  Customer.get_or_create_by_phone — deduplicación
# ─────────────────────────────────────────────────────────────

class CustomerDeduplicationTest(APITestCase):
    """Customer.get_or_create_by_phone() evita duplicados y normaliza teléfonos."""

    def setUp(self):
        Customer.objects.all().delete()

    def test_creates_customer_for_new_phone(self):
        customer = Customer.get_or_create_by_phone("3001234567", "Ana García")
        self.assertIsNotNone(customer)
        self.assertEqual(customer.phone, "3001234567")
        self.assertEqual(customer.name, "Ana García")

    def test_returns_existing_customer_for_same_phone(self):
        first  = Customer.get_or_create_by_phone("3001234567", "Ana García")
        second = Customer.get_or_create_by_phone("3001234567", "Ana García")
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(Customer.objects.filter(phone="3001234567").count(), 1)

    def test_updates_name_when_phone_matches(self):
        Customer.get_or_create_by_phone("3001234567", "Nombre Viejo")
        customer = Customer.get_or_create_by_phone("3001234567", "Nombre Nuevo")
        customer.refresh_from_db()
        self.assertEqual(customer.name, "Nombre Nuevo")

    def test_empty_phone_returns_none(self):
        result = Customer.get_or_create_by_phone("", "Sin Teléfono")
        self.assertIsNone(result)
        self.assertEqual(Customer.objects.count(), 0)

    def test_whitespace_only_phone_returns_none(self):
        result = Customer.get_or_create_by_phone("   ", "Solo Espacios")
        self.assertIsNone(result)

    def test_normalizes_phone_with_spaces(self):
        """'300 123 4567' debe tratarse igual que '3001234567'."""
        Customer.get_or_create_by_phone("300 123 4567", "Ana García")
        result = Customer.get_or_create_by_phone("3001234567", "Ana García")
        self.assertEqual(Customer.objects.count(), 1)

    def test_normalizes_phone_with_dashes(self):
        """'300-123-4567' debe tratarse igual que '3001234567'."""
        Customer.get_or_create_by_phone("300-123-4567", "Carlos")
        result = Customer.get_or_create_by_phone("3001234567", "Carlos")
        self.assertEqual(Customer.objects.count(), 1)

    def test_normalizes_phone_with_international_prefix(self):
        """+57 300 123 4567 → +573001234567 (conserva el +)."""
        c = Customer.get_or_create_by_phone("+57 300 123 4567", "María")
        self.assertEqual(c.phone, "+573001234567")

    def test_different_phones_create_different_customers(self):
        Customer.get_or_create_by_phone("3001234567", "Ana")
        Customer.get_or_create_by_phone("3109876543", "Luis")
        self.assertEqual(Customer.objects.count(), 2)
