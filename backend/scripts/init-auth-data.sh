#!/bin/bash

# Script d'initialisation de la plateforme de paiement de pensions
# Crée une organisation de test, un compte et des utilisateurs

echo "=== Initialisation de la plateforme ==="

# Attendre que Django soit prêt
echo "Attente du démarrage de Django..."
sleep 5

# Créer les données de test
docker exec -w /app/gateway gateway-web python manage.py shell <<EOF
from apps.accounts.models import Organization, User
from apps.bulk.models import Account

# Créer l'organisation CNSS Bénin
org, created = Organization.objects.get_or_create(
    code='CNSS-BJ',
    defaults={
        'name': 'Caisse Nationale de Sécurité Sociale du Bénin',
        'is_active': True
    }
)
print(f"Organisation: {org} ({'créée' if created else 'existe déjà'})")

# Créer le compte de paiement de l'organisation
account, created = Account.objects.get_or_create(
    account_id='ACC-CNSS-BJ',
    defaults={
        'party_id_type': 'MSISDN',
        'party_identifier': '22997000001',
        'balance': 10000000000,  # 100 millions XOF
        'reserved': 0,
        'organization': org
    }
)
print(f"Compte: {account} ({'créé' if created else 'existe déjà'})")

# Créer un gestionnaire
gestionnaire, created = User.objects.get_or_create(
    username='gestionnaire',
    defaults={
        'email': 'gestionnaire@cnss.bj',
        'first_name': 'Jean',
        'last_name': 'Dupont',
        'organization': org,
        'role': 'GESTIONNAIRE',
        'phone_number': '+22997123456',
        'is_active': True,
        'is_staff': False
    }
)
if created:
    gestionnaire.set_password('Pensions2025!')
    gestionnaire.save()
print(f"Gestionnaire: {gestionnaire} ({'créé' if created else 'existe déjà'})")

# Créer un superviseur
superviseur, created = User.objects.get_or_create(
    username='superviseur',
    defaults={
        'email': 'superviseur@cnss.bj',
        'first_name': 'Marie',
        'last_name': 'Kouadio',
        'organization': org,
        'role': 'SUPERVISEUR',
        'phone_number': '+22997654321',
        'is_active': True,
        'is_staff': False
    }
)
if created:
    superviseur.set_password('Audit2025!')
    superviseur.save()
print(f"Superviseur: {superviseur} ({'créé' if created else 'existe déjà'})")

# Créer un superuser admin
admin, created = User.objects.get_or_create(
    username='admin',
    defaults={
        'email': 'admin@cnss.bj',
        'first_name': 'Admin',
        'last_name': 'System',
        'organization': org,
        'role': 'GESTIONNAIRE',
        'is_active': True,
        'is_staff': True,
        'is_superuser': True
    }
)
if created:
    admin.set_password('Admin2025!')
    admin.save()
print(f"Admin: {admin} ({'créé' if created else 'existe déjà'})")

print("\n=== Résumé ===")
print(f"Organisation: {org.name}")
print(f"Compte: {account.account_id} - Solde: {account.balance/100:.2f} XOF")
print(f"\nUtilisateurs créés:")
print(f"  - Gestionnaire: username='gestionnaire', password='Pensions2025!'")
print(f"  - Superviseur: username='superviseur', password='Audit2025!'")
print(f"  - Admin: username='admin', password='Admin2025!'")
print("\nTest de connexion:")
print(f"  curl -X POST http://localhost:8000/api/auth/login \\")
print(f"    -H 'Content-Type: application/json' \\")
print(f"    -d '{\"username\":\"gestionnaire\",\"password\":\"Pensions2025!\"}'")
EOF

echo ""
echo "=== Initialisation terminée ==="
