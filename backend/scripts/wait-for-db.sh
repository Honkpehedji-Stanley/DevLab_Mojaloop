#!/usr/bin/env bash
set -e

host="$1"
shift
while true; do
  python - <<PY
import sys
import psycopg2
host = "${host}"
try:
    conn = psycopg2.connect(host=host, user="gateway", password="gateway", dbname="gateway", connect_timeout=2)
    conn.close()
    sys.exit(0)
except Exception as e:
    print('pg not ready:', e)
    sys.exit(1)
PY
  if [ $? -eq 0 ]; then
    echo "Postgres is ready"
    break
  fi
  echo "Waiting for postgres at $host..."
  sleep 1
done
