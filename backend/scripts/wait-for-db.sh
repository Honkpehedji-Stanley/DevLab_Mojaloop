#!/usr/bin/env bash
set -e

host="$1"
shift

# Brief sleep to ensure Docker DNS is ready
sleep 2

# Wait for DNS resolution first
echo "Waiting for DNS resolution of $host..."
while ! getent hosts "$host" > /dev/null 2>&1; do
  echo "DNS not ready for $host, waiting..."
  sleep 1
done
echo "DNS resolved $host"

# Now wait for postgres to be ready
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
