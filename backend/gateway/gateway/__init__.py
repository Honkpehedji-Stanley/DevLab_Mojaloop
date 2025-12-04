# Package marker for Django project
# Expose the Celery app instance so `celery -A gateway worker` works
# The Celery CLI looks for an attribute named 'celery' or 'app' in the specified module
from __future__ import absolute_import

# This will make Celery autodiscovery work
# Import the Celery app instance and expose it as both 'app' and 'celery'
from .celery import app

__all__ = ['app']

# Also expose as 'celery' for compatibility
celery = app