FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système pour psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les dépendances Python
COPY gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copier le projet
COPY gateway /app/gateway

ENV PYTHONUNBUFFERED=1

CMD ["/bin/sh", "-c", "python gateway/manage.py runserver 0.0.0.0:8000"]