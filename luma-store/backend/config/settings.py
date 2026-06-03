"""
Django settings para LUMA STORE SYSTEM.
Configuración unificada: desarrollo (SQLite + LocMemCache) y producción Railway (PostgreSQL + Redis).
"""

from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Seguridad base ─────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-cambia-esto-en-produccion")
DEBUG = os.getenv("DEBUG", "True") == "True"

ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

# Railway inyecta RAILWAY_PUBLIC_DOMAIN automáticamente al hacer deploy
_railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")
if _railway_domain and _railway_domain not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_railway_domain)

AUTH_USER_MODEL = "users.User"

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
    "cloudinary",               # SDK Cloudinary
    "cloudinary_storage",       # Backend de storage para Django
    # Apps del sistema
    "apps.users",
    "apps.inventory",
    "apps.sales",
    "apps.orders",
    "apps.customers",
    "apps.cash",
    "apps.reports",
    "apps.notifications",
    "apps.payments",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",           # Primero — requerido por django-cors-headers
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",      # Justo después de Security — sirve estáticos
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

# ── Base de datos ──────────────────────────────────────────────────────────────
# Desarrollo  → SQLite (sin DATABASE_URL)
# Producción  → PostgreSQL via DATABASE_URL (Railway lo inyecta automáticamente)
_database_url = os.getenv("DATABASE_URL", "")
if _database_url:
    DATABASES = {
        "default": dj_database_url.config(
            default=_database_url,
            conn_max_age=600,          # Reutiliza conexiones hasta 10 min
            conn_health_checks=True,   # Valida la conexión antes de usarla
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ── Caché ──────────────────────────────────────────────────────────────────────
# Desarrollo  → LocMemCache (sin REDIS_URL)
# Producción  → Redis via REDIS_URL (agregar addon Redis en Railway)
_redis_url = os.getenv("REDIS_URL", "")
if _redis_url:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": _redis_url,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "IGNORE_EXCEPTIONS": True,   # Si Redis cae, la app sigue funcionando
            },
            "TIMEOUT": 300,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "luma-store-cache",
            "TIMEOUT": 300,
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Cloudinary — lectura anticipada de credenciales ───────────────────────────
# Se lee aquí (antes de STORAGES) para que _cloudinary_ready esté disponible.
# La configuración completa de CLOUDINARY_STORAGE está más abajo.
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY    = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
_cloudinary_ready     = all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET])

# ── Archivos estáticos y media ─────────────────────────────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL   = "/media/"
MEDIA_ROOT  = BASE_DIR / "media"

# Django 4.2+ usa STORAGES dict.
# "default"     → Cloudinary si hay credenciales; filesystem si no (dev sin cuenta).
# "staticfiles" → WhiteNoise en producción (sin nginx); StaticFiles estándar en dev.
STORAGES = {
    "default": {
        "BACKEND": (
            "cloudinary_storage.storage.MediaCloudinaryStorage"
            if _cloudinary_ready
            else "django.core.files.storage.FileSystemStorage"
        ),
    },
    "staticfiles": {
        "BACKEND": (
            "whitenoise.storage.CompressedManifestStaticFilesStorage"
            if not DEBUG
            else "django.contrib.staticfiles.storage.StaticFilesStorage"
        ),
    },
}

# ── CORS ───────────────────────────────────────────────────────────────────────
# Dev: localhost admin (5173) + store (5174) siempre permitidos.
# Prod: agregar dominio(s) separados por coma en CORS_ALLOWED_ORIGINS del .env.
_cors_extra = [
    o.strip()
    for o in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if o.strip()
]
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
] + _cors_extra

# ── JWT ────────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ── Django REST Framework ──────────────────────────────────────────────────────
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
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon":  "600/hour",
        "user": "2000/hour",
    },
}

# ── Seguridad en producción (solo cuando DEBUG=False) ─────────────────────────
if not DEBUG:
    # Railway termina SSL en su proxy — sin SECURE_PROXY_SSL_HEADER Django
    # no detecta HTTPS y SECURE_SSL_REDIRECT causaría un loop infinito.
    SECURE_PROXY_SSL_HEADER        = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT            = True
    SESSION_COOKIE_SECURE          = True
    CSRF_COOKIE_SECURE             = True
    SECURE_HSTS_SECONDS            = 31_536_000   # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD            = True
    SECURE_CONTENT_TYPE_NOSNIFF    = True
    X_FRAME_OPTIONS                = "DENY"

# ── Variables de tienda ────────────────────────────────────────────────────────
STORE_NAME          = os.getenv("STORE_NAME", "Mi Tienda")
STORE_WHATSAPP      = os.getenv("STORE_WHATSAPP", "")
STORE_PRIMARY_COLOR = os.getenv("STORE_PRIMARY_COLOR", "#2E86C1")

# ── Cloudinary — configuración completa del SDK ───────────────────────────────
# Las credenciales se leen arriba (antes de STORAGES).
# Para vincular otro cliente: solo cambia las 3 variables en .env — sin tocar código.
#   1. Cliente crea cuenta en https://cloudinary.com (free: 25 GB almacenamiento)
#   2. Copia CLOUD_NAME, API_KEY y API_SECRET de su dashboard
#   3. Pega los valores en el .env del proyecto del cliente
CLOUDINARY_STORAGE = {
    "CLOUD_NAME": CLOUDINARY_CLOUD_NAME,
    "API_KEY":    CLOUDINARY_API_KEY,
    "API_SECRET": CLOUDINARY_API_SECRET,
    "SECURE":     True,        # Siempre URLs https://
    # Carpeta base en Cloudinary — separa activos por proyecto dentro de una misma cuenta.
    # Recomendado cuando varios proyectos comparten la misma cuenta Cloudinary.
    "MEDIA_TAG":  "luma-store",
}

# ── Email ──────────────────────────────────────────────────────────────────────
# Dev:  console backend (imprime en terminal, no envía nada)
# Prod: SMTP activado automáticamente cuando EMAIL_HOST_USER y PASSWORD están configurados
#
# Opciones gratuitas recomendadas:
#   Gmail SMTP   → hasta 500/día con App Password (sin costo)
#   Resend.com   → 3.000 emails/mes gratis, host: smtp.resend.com, port: 465
_email_configured = bool(os.getenv("EMAIL_HOST_USER") and os.getenv("EMAIL_HOST_PASSWORD"))
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if (not DEBUG and _email_configured)
    else "django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST          = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT          = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS       = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_HOST_USER     = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = os.getenv("DEFAULT_FROM_EMAIL", f"{STORE_NAME} <noreply@lumastore.co>")

# ── Pasarela de pagos (esqueleto) ──────────────────────────────────────────────
# PAYMENT_ENABLED=False → DummyProvider activo (no procesa cobros)
# Para activar: PAYMENT_ENABLED=True + PAYMENT_PROVIDER + claves correspondientes
#
# Proveedores soportados en el esqueleto: wompi | bold | stripe
# Wompi/Bold Colombia: sin costo fijo, solo ~2.9% por transacción exitosa
PAYMENT_ENABLED     = os.getenv("PAYMENT_ENABLED", "False") == "True"
PAYMENT_PROVIDER    = os.getenv("PAYMENT_PROVIDER", "")     # wompi | bold | stripe
PAYMENT_PUBLIC_KEY  = os.getenv("PAYMENT_PUBLIC_KEY", "")
PAYMENT_PRIVATE_KEY = os.getenv("PAYMENT_PRIVATE_KEY", "")

# ── Sentry — monitoreo de errores y performance ────────────────────────────────
# Sin SENTRY_DSN → Sentry no hace nada (desarrollo sin configurar).
# Con SENTRY_DSN → captura errores, performance y crashes en tiempo real.
# Railway inyecta RAILWAY_GIT_COMMIT_SHA en cada deploy para rastrear releases.
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[
            DjangoIntegration(
                transaction_style="url",        # Agrupa por patrón de URL, no por valor
                middleware_spans=True,          # Traza tiempo de cada middleware
                signals_spans=False,            # No trazar señales de Django (ruido)
            ),
        ],
        traces_sample_rate=0.2,                 # Monitorea el 20% de requests
        profiles_sample_rate=0.1,              # Profila el 10% de los trazados
        send_default_pii=False,                # No enviar datos personales (GDPR)
        environment="development" if DEBUG else "production",
        # Railway provee el SHA del commit en cada deploy — permite ver qué versión
        # generó cada error directamente en el dashboard de Sentry
        release=os.getenv("RAILWAY_GIT_COMMIT_SHA", "local"),
    )
