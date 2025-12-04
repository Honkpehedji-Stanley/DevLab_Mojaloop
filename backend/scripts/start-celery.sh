#!/usr/bin/env bash
set -e

./scripts/wait-for-db.sh db
exec celery -A gateway worker -l info
