FROM python:3.11-slim

LABEL maintainer="Mojaloop Gateway"
LABEL description="Django gateway pour transferts groupés Mojaloop"

WORKDIR /app

# Installer les dépendances système (combiné pour réduire les layers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copier et installer les requirements Python (cache efficace)
COPY gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copier le code de l'application
COPY gateway /app/gateway
COPY scripts /app/scripts

# Créer un utilisateur non-root pour exécuter l'application
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Variables d'environnement par défaut
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/gateway

WORKDIR /app/gateway

# Healthcheck simplifié (sans requests pour économiser ressources)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=2 \
    CMD curl -f http://localhost:8000/ || exit 1

# Commande par défaut (surchargée dans docker-compose.yml)
CMD ["gunicorn", "gateway.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60", "--preload"]
