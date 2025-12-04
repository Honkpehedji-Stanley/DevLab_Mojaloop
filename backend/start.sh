#!/bin/bash
# Script de démarrage rapide pour DevLab Mojaloop

set -e

echo "🚀 DevLab Mojaloop - Démarrage rapide"
echo "======================================"

cd "$(dirname "$0")"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

echo "✅ Docker détecté"

# Arrêter les conteneurs existants
echo "🛑 Arrêt des conteneurs existants..."
docker compose down --remove-orphans 2>/dev/null || true

# Build si nécessaire
if [ "$1" == "--build" ]; then
    echo "🔨 Build des images Docker..."
    docker compose build web celery redis
fi

# Démarrer les services essentiels
echo "🚀 Démarrage des services..."
docker compose up -d redis

echo "⏳ Attente de Redis..."
sleep 5

echo "🌐 Démarrage de l'application web..."
docker compose up -d web

echo "⏳ Attente de l'application (migrations, etc.)..."
sleep 10

echo "👷 Démarrage de Celery..."
docker compose up -d celery

echo ""
echo "✅ Services démarrés !"
echo ""
echo "📍 URLs disponibles:"
echo "   - API Gateway: http://localhost:8000"
echo "   - Swagger UI: http://localhost:8000/swagger/"
echo "   - Admin: http://localhost:8000/admin/"
echo ""
echo "🔐 Authentification:"
echo "   - Login: POST http://localhost:8000/api/auth/login"
echo "   - Me: GET http://localhost:8000/api/auth/me"
echo ""
echo "📊 Vérifier les logs:"
echo "   docker compose logs -f web"
echo ""
echo "🛑 Arrêter les services:"
echo "   docker compose down"
