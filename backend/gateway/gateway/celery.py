from __future__ import annotations

import os
from celery import Celery

# Ensure the Django settings module is set for Celery (can be overridden in env)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'gateway.settings.dev'))

# Create the Celery application instance early so the module import never fails
app = Celery('gateway')

# Attempt to configure the Celery app from Django settings if available.
# This is intentionally resilient: if Django or other deps are not yet
# installed/available at import time (e.g. during image build or in a
# constrained environment), we still expose a valid Celery instance so
# `celery -A gateway worker` can import the module without raising
# "Module 'gateway' has no attribute 'celery'". The app may be further
# configured at runtime when Django is available.
try:
    # Importing django.conf may raise if Django is not installed yet
    from django.conf import settings as django_settings  # type: ignore
    app.config_from_object('django.conf:settings', namespace='CELERY')
    # Auto-discover tasks only when Django is present and configured
    app.autodiscover_tasks()
except Exception:
    # We purposely swallow exceptions here to avoid hard failures during
    # import. The Celery app instance `app` still exists and will be
    # usable once the environment is correctly prepared.
    pass


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
