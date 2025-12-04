#!/usr/bin/env bash
set -e

./scripts/wait-for-db.sh db
python gateway/manage.py migrate --noinput
exec gunicorn gateway.wsgi:application --bind 0.0.0.0:8000
