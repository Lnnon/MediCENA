from .settings import *  # noqa: F403


# Keep Django test migrations and fixtures separate from configured databases.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    },
}
