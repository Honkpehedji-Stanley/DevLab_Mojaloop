"""
Configuration Celery pour la gateway Django.
Permet l'exécution asynchrone des tâches de transfert Mojaloop.
"""
from __future__ import annotations
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get('DJANGO_SETTINGS_MODULE', 'gateway.settings.dev'))

app = Celery('gateway')

try:
    from django.conf import settings as django_settings
    app.config_from_object('django.conf:settings', namespace='CELERY')
    app.autodiscover_tasks()
except Exception:
    # Gestion silencieuse pour permettre l'import pendant le build Docker
    pass


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
