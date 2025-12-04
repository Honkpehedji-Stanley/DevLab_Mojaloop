#!/usr/bin/env bash
set -e

host="$1"
shift
until pg_isready -h "$host"; do
  echo "Waiting for postgres at $host..."
  sleep 1
done

echo "Postgres is ready"
