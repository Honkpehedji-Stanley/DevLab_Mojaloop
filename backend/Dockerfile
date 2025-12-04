FROM python:3.11-slim

# Image skeleton for the Django gateway application.
# Add application code, install requirements and run via Gunicorn in production.

WORKDIR /app

# Copy requirements and install (fill later)
COPY gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt || true

# Copy project (to be populated)
COPY gateway /app/gateway

ENV PYTHONUNBUFFERED=1

CMD ["/bin/sh", "-c", "python gateway/manage.py runserver 0.0.0.0:8000"]
