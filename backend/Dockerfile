FROM python:3.11-slim

LABEL maintainer="Mojaloop Gateway"
LABEL description="Django gateway pour transferts groupés Mojaloop"

WORKDIR /app

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les requirements Python
COPY gateway/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
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

# Healthcheck pour vérifier que l'application est opérationnelle
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/bulk-transfers', timeout=5)" || exit 1

# Commande par défaut (surchargée dans docker-compose.yml)
CMD ["gunicorn", "gateway.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
