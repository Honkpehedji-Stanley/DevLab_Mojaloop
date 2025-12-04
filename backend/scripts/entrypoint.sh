#!/bin/bash
set -e

echo "==> Waiting for database..."
python manage.py check --database default || true

echo "==> Running migrations..."
python manage.py makemigrations --noinput || true
python manage.py migrate --noinput || true

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear 2>/dev/null || true

echo "==> Creating superuser if needed..."
python manage.py shell << PYTHON 2>/dev/null || true
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
PYTHON

echo "==> Starting application..."
exec "$@"
