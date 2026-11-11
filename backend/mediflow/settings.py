from datetime import timedelta
import os
from pathlib import Path
import re
from decouple import config


from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured


BASE_DIR = Path(__file__).resolve().parent.parent




def load_env_file(path):
    if not path.exists():
        return

    for line in path.read_text().splitlines():
        clean_line = line.strip()
        if not clean_line or clean_line.startswith("#") or "=" not in clean_line:
            continue
        key, value = clean_line.split("=", 1)
        clean_value = value.strip().strip('"').strip("'")
        variable_match = re.fullmatch(r"\$\{([^}]+)\}", clean_value)
        if variable_match:
            variable_name = variable_match.group(1)
            clean_value = os.environ.get(variable_name, variable_name)
        os.environ.setdefault(key.strip(), clean_value)


load_env_file(BASE_DIR / ".env")

DEFAULT_QGIS_BIN_DIRS = [
    Path(r"C:\Program Files\QGIS 4.0.2\bin"),
    Path(r"C:\Program Files\QGIS 3.44.10\bin"),
]

for qgis_bin_dir in DEFAULT_QGIS_BIN_DIRS:
    if not qgis_bin_dir.exists():
        continue

    qgis_root = qgis_bin_dir.parent
    qgis_dll_dirs = [
        qgis_bin_dir,
        qgis_root / "apps" / "gdal" / "bin",
        qgis_root / "apps" / "qgis" / "bin",
        qgis_root / "apps" / "Qt6" / "bin",
    ]

    for dll_dir in qgis_dll_dirs:
        if dll_dir.exists() and hasattr(os, "add_dll_directory"):
            os.add_dll_directory(str(dll_dir))

    os.environ.setdefault("GDAL_LIBRARY_PATH", str(qgis_bin_dir / "gdal312.dll"))
    os.environ.setdefault("GEOS_LIBRARY_PATH", str(qgis_bin_dir / "geos_c.dll"))
    break

GDAL_LIBRARY_PATH = os.environ.get("GDAL_LIBRARY_PATH")
GEOS_LIBRARY_PATH = os.environ.get("GEOS_LIBRARY_PATH")

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in {"1", "true", "yes"}
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "mediflow-local-development-secret-key")

if not DEBUG and "DJANGO_SECRET_KEY" not in os.environ:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is False.")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get(
        "DJANGO_ALLOWED_HOSTS",
        "localhost,127.0.0.1",
    ).split(",")
    if host.strip()
]

# Render supplies the hostname assigned to this service at deploy time.
render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "core",

]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    *(["whitenoise.middleware.WhiteNoiseMiddleware"] if not DEBUG else []),
    "django.middleware.common.CommonMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "mediflow.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
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

WSGI_APPLICATION = "mediflow.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": os.environ.get("DJANGO_DB_ENGINE", "django.db.backends.sqlite3"),
        "NAME": os.environ.get("DJANGO_DB_NAME", BASE_DIR / "db.sqlite3"),
        "USER": os.environ.get("DJANGO_DB_USER", os.environ.get("DB_USER", "")),
        "PASSWORD": os.environ.get("DJANGO_DB_PASSWORD", os.environ.get("DB_PASSWORD", "")),
        "HOST": os.environ.get("DJANGO_DB_HOST", os.environ.get("DB_HOST", "")),
        "PORT": os.environ.get("DJANGO_DB_PORT", os.environ.get("DB_PORT", "")),
    }
}

if os.environ.get("DB_NAME"):
    DATABASES["gis"] = {
        "ENGINE": os.environ.get("DJANGO_GIS_DB_ENGINE", "django.db.backends.postgresql"),
        "NAME": os.environ.get("DB_NAME"),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", ""),
        "PORT": os.environ.get("DB_PORT", ""),
    }

for alias, variable in (("default", "DJANGO_DB_SSLMODE"), ("gis", "DJANGO_GIS_DB_SSLMODE")):
    sslmode = os.environ.get(variable)
    if sslmode and alias in DATABASES and DATABASES[alias]["ENGINE"] == "django.db.backends.postgresql":
        DATABASES[alias]["OPTIONS"] = {"sslmode": sslmode}

AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Singapore"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_CREDENTIALS = True

LOCAL_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
PRODUCTION_CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ALLOWED_ORIGINS = LOCAL_CORS_ORIGINS if DEBUG else PRODUCTION_CORS_ORIGINS

if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("DJANGO_CORS_ALLOWED_ORIGINS must be set when DJANGO_DEBUG is False.")

CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("DJANGO_EMAIL_HOST", default="localhost")
EMAIL_PORT = config("DJANGO_EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("DJANGO_EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("DJANGO_EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("DJANGO_EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_USE_SSL = config("DJANGO_EMAIL_USE_SSL", default=False, cast=bool)
EMAIL_TIMEOUT = config("DJANGO_EMAIL_TIMEOUT", default=15, cast=int)
DEFAULT_FROM_EMAIL = config("DJANGO_DEFAULT_FROM_EMAIL", default="webmaster@localhost")
RESEND_API_KEY = config("RESEND_API_KEY", default="")
RESEND_FROM_EMAIL = config("RESEND_FROM_EMAIL", default="")

# SMS is opt-in and disabled until a supported gateway is configured.
SMS_PROVIDER = config("SMS_PROVIDER", default="disabled")
TWILIO_ACCOUNT_SID = config("TWILIO_ACCOUNT_SID", default="")
TWILIO_AUTH_TOKEN = config("TWILIO_AUTH_TOKEN", default="")
TWILIO_FROM_NUMBER = config("TWILIO_FROM_NUMBER", default="")
SMS_TIMEOUT = config("SMS_TIMEOUT", default=15, cast=int)
SMS_MAX_ATTEMPTS = config("SMS_MAX_ATTEMPTS", default=3, cast=int)
