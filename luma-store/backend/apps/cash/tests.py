import datetime
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CashSession, CashMovement

User = get_user_model()


def _auth(client, user):
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token.access_token)}")


def _make_admin(username="admin_cash"):
    return User.objects.create_user(username=username, password="pass", role="admin")


def _open_session(user, date=None, opening=10000):
    """Helper: crea una sesión de caja abierta."""
    if date is None:
        date = timezone.localdate()
    return CashSession.objects.create(
        date=date,
        opening_amount=opening,
        status="open",
        opened_by=user,
    )


# ─────────────────────────────────────────────────────────────
#  CashSessionViewSet — apertura de sesión
# ─────────────────────────────────────────────────────────────

class CashSessionTest(APITestCase):
    """POST /api/v1/cash/sessions/ — apertura de caja."""

    LIST_URL = "/api/v1/cash/sessions/"

    def setUp(self):
        self.admin = _make_admin()
        _auth(self.client, self.admin)
        # Limpiar sesiones del día para evitar conflictos entre tests
        CashSession.objects.all().delete()

    def test_open_session_today_returns_201(self):
        resp = self.client.post(
            self.LIST_URL,
            {"date": str(timezone.localdate()), "opening_amount": 50000, "opened_by": self.admin.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_opened_session_has_status_open(self):
        resp = self.client.post(
            self.LIST_URL,
            {"date": str(timezone.localdate()), "opening_amount": 50000, "opened_by": self.admin.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], "open")

    def test_second_session_same_day_returns_400(self):
        _open_session(self.admin)
        resp = self.client.post(
            self.LIST_URL,
            {"date": str(timezone.localdate()), "opening_amount": 20000, "opened_by": self.admin.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_sessions_returns_200(self):
        _open_session(self.admin)
        resp = self.client.get(self.LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_unauthenticated_cannot_open_session(self):
        self.client.credentials()
        resp = self.client.post(
            self.LIST_URL,
            {"date": str(timezone.localdate()), "opening_amount": 10000, "opened_by": self.admin.id},
            format="json",
        )
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


# ─────────────────────────────────────────────────────────────
#  CashSessionViewSet — cierre de sesión
# ─────────────────────────────────────────────────────────────

class CashCloseTest(APITestCase):
    """POST /api/v1/cash/sessions/{id}/close/ — cierre con conteo físico."""

    LIST_URL = "/api/v1/cash/sessions/"

    def setUp(self):
        self.admin = _make_admin(username="admin_close")
        _auth(self.client, self.admin)
        CashSession.objects.all().delete()
        self.session = _open_session(self.admin, opening=50000)

    def _close_url(self):
        return f"{self.LIST_URL}{self.session.id}/close/"

    def test_close_session_with_counted_amount_returns_200(self):
        resp = self.client.post(self._close_url(), {"counted_amount": 60000}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_close_sets_status_closed(self):
        self.client.post(self._close_url(), {"counted_amount": 60000}, format="json")
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, "closed")

    def test_closing_amount_equals_opening_plus_income(self):
        """closing_amount = opening_amount + total_income."""
        CashMovement.objects.create(
            session=self.session,
            type="income",
            amount=20000,
            description="Venta manual",
            payment_method="cash",
            created_by=self.admin,
        )
        resp = self.client.post(self._close_url(), {"counted_amount": 70000}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # closing = 50000 opening + 20000 income = 70000
        self.assertAlmostEqual(float(resp.data["closing_amount"]), 70000.0, places=2)

    def test_difference_is_counted_minus_closing(self):
        resp = self.client.post(self._close_url(), {"counted_amount": 52000}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # difference = 52000 counted - 50000 closing = 2000
        self.assertAlmostEqual(float(resp.data["difference"]), 2000.0, places=2)

    def test_close_without_counted_amount_returns_400(self):
        resp = self.client.post(self._close_url(), {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_close_already_closed_session_returns_400(self):
        self.client.post(self._close_url(), {"counted_amount": 50000}, format="json")
        resp = self.client.post(self._close_url(), {"counted_amount": 50000}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────
#  Auto-cierre de sesiones olvidadas
# ─────────────────────────────────────────────────────────────

class AutoCloseTest(APITestCase):
    """POST /api/v1/cash/sessions/check-stale/ — auto-cierre de sesiones antiguas."""

    CHECK_STALE_URL = "/api/v1/cash/sessions/check-stale/"

    def setUp(self):
        self.admin = _make_admin(username="admin_stale")
        _auth(self.client, self.admin)
        CashSession.objects.all().delete()

    def test_check_stale_closes_yesterday_session(self):
        yesterday = timezone.localdate() - datetime.timedelta(days=1)
        stale = CashSession.objects.create(
            date=yesterday,
            opening_amount=30000,
            status="open",
            opened_by=self.admin,
        )
        resp = self.client.post(self.CHECK_STALE_URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["auto_closed_count"], 1)
        stale.refresh_from_db()
        self.assertEqual(stale.status, "closed")
        self.assertTrue(stale.auto_closed)

    def test_check_stale_does_not_close_todays_session(self):
        _open_session(self.admin)
        resp = self.client.post(self.CHECK_STALE_URL, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["auto_closed_count"], 0)

    def test_check_stale_returns_closed_session_ids(self):
        yesterday = timezone.localdate() - datetime.timedelta(days=1)
        stale = CashSession.objects.create(
            date=yesterday,
            opening_amount=10000,
            status="open",
            opened_by=self.admin,
        )
        resp = self.client.post(self.CHECK_STALE_URL, format="json")
        closed_ids = [s["id"] for s in resp.data.get("auto_closed_sessions", [])]
        self.assertIn(stale.id, closed_ids)


# ─────────────────────────────────────────────────────────────
#  CashMovementViewSet
# ─────────────────────────────────────────────────────────────

class CashMovementTest(APITestCase):
    """POST /api/v1/cash/movements/ y filtros."""

    LIST_URL = "/api/v1/cash/movements/"

    def setUp(self):
        self.admin = _make_admin(username="admin_mov")
        _auth(self.client, self.admin)
        CashSession.objects.all().delete()
        self.session = _open_session(self.admin, opening=20000)
        self.other_session = CashSession.objects.create(
            date=timezone.localdate() - datetime.timedelta(days=2),
            opening_amount=10000,
            status="closed",
            opened_by=self.admin,
        )

    def _movement_payload(self, session=None):
        return {
            "session": (session or self.session).id,
            "type": "income",
            "amount": 15000,
            "description": "Venta en efectivo",
            "payment_method": "cash",
        }

    def test_create_movement_returns_201(self):
        resp = self.client.post(self.LIST_URL, self._movement_payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_created_movement_has_correct_created_by(self):
        resp = self.client.post(self.LIST_URL, self._movement_payload(), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        movement = CashMovement.objects.get(id=resp.data["id"])
        self.assertEqual(movement.created_by_id, self.admin.id)

    def test_filter_by_session_returns_only_that_session(self):
        # Crear movimiento en sesión principal
        CashMovement.objects.create(
            session=self.session,
            type="income",
            amount=5000,
            description="Sesión principal",
            payment_method="cash",
            created_by=self.admin,
        )
        # Crear movimiento en otra sesión
        CashMovement.objects.create(
            session=self.other_session,
            type="expense",
            amount=2000,
            description="Otra sesión",
            payment_method="cash",
            created_by=self.admin,
        )
        resp = self.client.get(f"{self.LIST_URL}?session={self.session.id}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        for mov in results:
            self.assertEqual(mov["session"], self.session.id)

    def test_unauthenticated_cannot_create_movement(self):
        self.client.credentials()
        resp = self.client.post(self.LIST_URL, self._movement_payload(), format="json")
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
