"""
Django settings for LUMA STORE SYSTEM.
Fase 1 — Configuración base del proyecto.
"""

from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import os

# Cargar variables del .env
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── SEGURIDAD ──────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-cambia-esto-en-produccion")
DEBUG = os.getenv("DEBUG", "True") == "True"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ─── AUTH USER MODEL ─────────────────────────────────────
# DEBE estar declarado ANTES de la primera migración
AUTH_USER_MODEL = "users.User"

# ─── APPS INSTALADAS ─────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Terceros
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    # Apps del sistema
    "apps.users",
    "apps.inventory",
    "apps.sales",
    "apps.orders",
    "apps.customers",
    "apps.cash",
    "apps.reports",
]

# ─── MIDDLEWARE ──────────────────────────────────────────
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # DEBE ser el primero
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ─── BASE DE DATOS ───────────────────────────────────────
# DESARROLLO: SQLite (sin configuración adicional)
# PRODUCCIÓN: Cambiar a PostgreSQL con variables de entorno
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ─── VALIDACIÓN DE CONTRASEÑAS ───────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── INTERNACIONALIZACIÓN ────────────────────────────────
LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

# ─── ARCHIVOS ESTÁTICOS ──────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ─── ARCHIVOS MULTIMEDIA (imágenes de productos) ─────────
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ─── DEFAULT PRIMARY KEY ─────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── CORS ────────────────────────────────────────────────
# Permitir peticiones del frontend React en desarrollo
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Panel Admin
    "http://localhost:5174",  # Portal de Clientes
]

# ─── JWT ─────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ─── DJANGO REST FRAMEWORK ───────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# ─── CONFIGURACIÓN DE TIENDA (desde .env) ────────────────
STORE_NAME = os.getenv("STORE_NAME", "Mi Tienda")
STORE_WHATSAPP = os.getenv("STORE_WHATSAPP", "")
STORE_PRIMARY_COLOR = os.getenv("STORE_PRIMARY_COLOR", "#2E86C1")
PAYMENT_ENABLED = os.getenv("PAYMENT_ENABLED", "False") == "True"
