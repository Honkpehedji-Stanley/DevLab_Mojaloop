#!/usr/bin/env bash
set -e

./scripts/wait-for-db.sh db
python gateway/manage.py migrate --noinput
python gateway/manage.py collectstatic --noinput
