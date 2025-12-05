#!/bin/bash

# Script d'installation automatique de la Plateforme de Paiement de Pensions
# Ce script configure le backend et crée les données de test nécessaires

set -e  # Arrêter en cas d'erreur

echo "=== Installation de la Plateforme de Paiement de Pensions ==="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier les prérequis
info "Vérification des prérequis..."

if ! command -v docker &> /dev/null; then
    error "Docker n'est pas installé. Veuillez installer Docker avant de continuer."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    error "Docker Compose n'est pas installé. Veuillez installer Docker Compose avant de continuer."
    exit 1
fi

info "✓ Docker et Docker Compose sont installés"

# Naviguer vers le répertoire backend
cd "$(dirname "$0")/backend"

# Créer le fichier .env s'il n'existe pas
if [ ! -f .env ]; then
    info "Création du fichier .env..."
    cp .env.example .env 2>/dev/null || echo "USE_SQLITE=True" > .env
fi

# Démarrer les services Docker
info "Démarrage des services Docker..."
docker compose up -d --build

# Attendre que les services soient prêts
info "Attente du démarrage des services..."
sleep 10

# Vérifier que les conteneurs sont démarrés
if ! docker compose ps | grep -q "Up"; then
    error "Les conteneurs ne sont pas démarrés correctement"
    docker compose ps
    exit 1
fi

info "✓ Services Docker démarrés"

# Corriger les permissions de la base de données
info "Configuration des permissions de la base de données..."
docker exec --user root gateway-web chmod 666 /app/gateway/db.sqlite3 2>/dev/null || true
docker exec --user root gateway-web chmod 777 /app/gateway 2>/dev/null || true

# Appliquer les migrations
info "Application des migrations..."
docker exec -w /app/gateway gateway-web python manage.py migrate --noinput

# Créer les données de test
info "Création des données de test..."

# Créer l'organisation et le compte
docker exec -w /app/gateway gateway-web python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gateway.settings.dev')
import django
django.setup()

from apps.accounts.models import Organization
from apps.bulk.models import Account

# Créer l'organisation
org, created = Organization.objects.get_or_create(
    code='CNSS-BJ',
    defaults={'name': 'CNSS Bénin', 'is_active': True}
)
print(f'Organisation: {org.name} ({'créée' if created else 'existe déjà'})')

# Créer le compte de paiement
account, created = Account.objects.get_or_create(
    account_id='ACC-CNSS-BJ',
    defaults={
        'party_id_type': 'MSISDN',
        'party_identifier': '22997000001',
        'balance': 10000000000,
        'reserved': 0,
        'organization': org
    }
)
print(f'Compte: {account.account_id} - Solde: {account.balance/100:.2f} XOF ({'créé' if created else 'existe déjà'})')
"

# Créer l'utilisateur
info "Création de l'utilisateur gestionnaire..."
docker exec -w /app/gateway gateway-web python manage.py createsuperuser --noinput --username gestionnaire --email gestionnaire@cnss.bj 2>/dev/null || warn "L'utilisateur existe déjà"

# Configurer l'utilisateur
docker exec -w /app/gateway gateway-web python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gateway.settings.dev')
import django
django.setup()

from apps.accounts.models import Organization, User

org = Organization.objects.get(code='CNSS-BJ')
user = User.objects.get(username='gestionnaire')
user.organization = org
user.role = 'GESTIONNAIRE'
user.set_password('Pensions2025!')
user.save()

print('Utilisateur configuré avec succès')
print(f'Username: {user.username}')
print(f'Organisation: {user.organization}')
print('Mot de passe: Pensions2025!')
"

info "✓ Données de test créées"

# Tester la connexion
info "Test de connexion..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"gestionnaire","password":"Pensions2025!"}')

if echo "$RESPONSE" | grep -q "access"; then
    info "✓ Connexion réussie !"
else
    error "Échec de la connexion"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "=== Installation Terminée avec Succès ! ==="
echo ""
info "Backend accessible sur: http://localhost:8000"
info "Identifiants de connexion:"
echo "  - Username: gestionnaire"
echo "  - Password: Pensions2025!"
echo ""
info "Pour démarrer le frontend:"
echo "  cd ../frontend"
echo "  npm install"
echo "  npm run dev"
echo ""
info "Le frontend sera accessible sur: http://localhost:5173"
echo ""
