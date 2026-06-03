from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import StoreConfig

User = get_user_model()

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _auth(client, user):
    """Attach a valid JWT Bearer token for *user* to *client*."""
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")


# ---------------------------------------------------------------------------
# Shared setUp mixin
# ---------------------------------------------------------------------------

class BaseUserTestCase(APITestCase):
    """Creates common users and a StoreConfig singleton used by all suites."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner", password="ownerpass123", role="owner"
        )
        self.admin = User.objects.create_user(
            username="admin_user", password="adminpass123", role="admin"
        )
        self.seller = User.objects.create_user(
            username="seller_user", password="sellerpass123", role="seller"
        )
        self.store_config, _ = StoreConfig.objects.get_or_create(
            pk=1,
            defaults={
                "name": "LUMA Test Store",
                "whatsapp": "573001234567",
                "primary_color": "#2E86C1",
                "payment_methods": [
                    {"key": "cash", "label": "Efectivo", "enabled": True},
                    {"key": "nequi", "label": "Nequi", "enabled": True},
                ],
            },
        )


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

class AuthTests(BaseUserTestCase):

    def test_login_valid_credentials_returns_tokens(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "owner", "password": "ownerpass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_wrong_password_returns_401(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            {"username": "owner", "password": "wrongpassword"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_without_token_returns_401(self):
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_owner_token_returns_user_data(self):
        _auth(self.client, self.owner)
        response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "owner")
        self.assertIn("role", response.data)
        self.assertEqual(response.data["role"], "owner")

    def test_refresh_token_returns_new_access(self):
        refresh = RefreshToken.for_user(self.owner)
        response = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


# ---------------------------------------------------------------------------
# User CRUD tests
# ---------------------------------------------------------------------------

class UserCRUDTests(BaseUserTestCase):

    def test_owner_can_list_users(self):
        _auth(self.client, self.owner)
        response = self.client.get("/api/v1/auth/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_seller_cannot_list_users(self):
        _auth(self.client, self.seller)
        response = self.client.get("/api/v1/auth/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_create_user_and_password_is_hashed(self):
        _auth(self.client, self.owner)
        payload = {
            "username": "new_seller",
            "password": "securepass456",
            "role": "seller",
        }
        response = self.client.post("/api/v1/auth/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created = User.objects.get(username="new_seller")
        # Password must be stored hashed, never as plain text
        self.assertNotEqual(created.password, "securepass456")
        self.assertTrue(created.check_password("securepass456"))

    def test_owner_can_patch_user(self):
        _auth(self.client, self.owner)
        response = self.client.patch(
            f"/api/v1/auth/users/{self.seller.pk}/",
            {"first_name": "Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.seller.refresh_from_db()
        self.assertEqual(self.seller.first_name, "Updated")

    def test_delete_deactivates_user_instead_of_removing(self):
        _auth(self.client, self.owner)
        target = User.objects.create_user(
            username="to_deactivate", password="pass1234", role="viewer"
        )
        response = self.client.delete(f"/api/v1/auth/users/{target.pk}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        target.refresh_from_db()
        self.assertFalse(target.is_active)
        # Record must still exist in the database
        self.assertTrue(User.objects.filter(pk=target.pk).exists())


# ---------------------------------------------------------------------------
# Store config tests
# ---------------------------------------------------------------------------

class StoreConfigTests(BaseUserTestCase):

    def test_owner_can_get_store_config(self):
        _auth(self.client, self.owner)
        response = self.client.get("/api/v1/config/store/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("name", response.data)
        self.assertIn("whatsapp", response.data)
        self.assertIn("payment_methods", response.data)

    def test_owner_can_patch_store_name(self):
        _auth(self.client, self.owner)
        response = self.client.patch(
            "/api/v1/config/store/",
            {"name": "LUMA Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.store_config.refresh_from_db()
        self.assertEqual(self.store_config.name, "LUMA Updated")

    def test_seller_cannot_access_store_config(self):
        _auth(self.client, self.seller)
        response = self.client.get("/api/v1/config/store/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Payment methods tests
# ---------------------------------------------------------------------------

class PaymentMethodsTests(BaseUserTestCase):

    def test_owner_can_get_payment_methods(self):
        _auth(self.client, self.owner)
        response = self.client.get("/api/v1/config/payment-methods/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)

    def test_admin_can_get_payment_methods(self):
        _auth(self.client, self.admin)
        response = self.client.get("/api/v1/config/payment-methods/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_seller_cannot_get_payment_methods(self):
        _auth(self.client, self.seller)
        response = self.client.get("/api/v1/config/payment-methods/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_put_new_payment_methods_list(self):
        _auth(self.client, self.owner)
        new_methods = [
            {"key": "cash", "label": "Efectivo", "enabled": True},
            {"key": "transfer", "label": "Transferencia", "enabled": False},
        ]
        response = self.client.put(
            "/api/v1/config/payment-methods/",
            new_methods,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.store_config.refresh_from_db()
        self.assertEqual(self.store_config.payment_methods, new_methods)


# ---------------------------------------------------------------------------
# Public store config tests
# ---------------------------------------------------------------------------

class PublicConfigTests(BaseUserTestCase):

    def test_public_config_accessible_without_auth(self):
        # No credentials set — anonymous request
        response = self.client.get("/api/v1/store/config/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_public_config_exposes_name_and_primary_color(self):
        response = self.client.get("/api/v1/store/config/")
        self.assertIn("name", response.data)
        self.assertIn("primary_color", response.data)

    def test_public_config_does_not_expose_whatsapp_templates(self):
        response = self.client.get("/api/v1/store/config/")
        # WhatsApp message templates are internal and must NOT be exposed
        for private_field in (
            "msg_confirmed",
            "msg_in_progress",
            "msg_preparing",
            "msg_shipped",
            "msg_delivered",
            "msg_cancelled",
        ):
            self.assertNotIn(private_field, response.data, msg=f"{private_field} must not be public")
