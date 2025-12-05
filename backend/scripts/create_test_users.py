#!/usr/bin/env python
"""
Script pour créer des utilisateurs de test avec email.
Usage: docker compose exec web python scripts/create_test_users.py
"""
import os
import sys
import django

# Configuration Django
sys.path.insert(0, '/app/gateway')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gateway.settings.dev')
django.setup()

from apps.accounts.models import User, Organization
from apps.bulk.models import Account


def create_test_users():
    """Crée une organisation et des utilisateurs de test."""
    
    print("=" * 60)
    print("Création des utilisateurs de test")
    print("=" * 60)
    
    # 1. Créer l'organisation CNSS Bénin
    org, created = Organization.objects.get_or_create(
        code='CNSS-BJ',
        defaults={
            'name': 'Caisse Nationale de Sécurité Sociale - Bénin',
            'is_active': True
        }
    )
    if created:
        print(f"✓ Organisation créée: {org.name}")
    else:
        print(f"→ Organisation existante: {org.name}")
    
    # 2. Créer le compte de l'organisation (100 millions XOF)
    account, created = Account.objects.get_or_create(
        account_id='CNSS-BJ-001',
        defaults={
            'organization': org,
            'party_id_type': 'ORG',
            'party_identifier': 'CNSS-BJ',
            'balance': 100_000_000,  # 100M XOF (en centimes si XOF utilise des centimes)
            'reserved': 0,
        }
    )
    if created:
        print(f"✓ Compte créé: {account.account_id} - Balance: {account.balance:,} XOF")
    else:
        print(f"→ Compte existant: {account.account_id} - Balance: {account.balance:,} XOF")
    
    print("\n" + "-" * 60)
    print("Utilisateurs de test")
    print("-" * 60)
    
    # 3. Créer un gestionnaire (peut créer des transferts)
    gestionnaire, created = User.objects.get_or_create(
        username='gestionnaire',
        defaults={
            'email': 'gestionnaire@cnss.bj',
            'first_name': 'Jean',
            'last_name': 'Kouadio',
            'organization': org,
            'role': User.ROLE_GESTIONNAIRE,
            'is_active': True,
            'is_staff': False,
            'phone_number': '+22997123456'
        }
    )
    if created:
        gestionnaire.set_password('Pass@123')
        gestionnaire.save()
        print(f"\n✓ Gestionnaire créé:")
        print(f"   Email    : gestionnaire@cnss.bj")
        print(f"   Password : Pass@123")
        print(f"   Rôle     : {gestionnaire.get_role_display()}")
    else:
        print(f"\n→ Gestionnaire existant: {gestionnaire.email}")
    
    # 4. Créer un superviseur (lecture seule)
    superviseur, created = User.objects.get_or_create(
        username='superviseur',
        defaults={
            'email': 'superviseur@cnss.bj',
            'first_name': 'Marie',
            'last_name': 'Adjovi',
            'organization': org,
            'role': User.ROLE_SUPERVISEUR,
            'is_active': True,
            'is_staff': False,
            'phone_number': '+22997654321'
        }
    )
    if created:
        superviseur.set_password('Pass@456')
        superviseur.save()
        print(f"\n✓ Superviseur créé:")
        print(f"   Email    : superviseur@cnss.bj")
        print(f"   Password : Pass@456")
        print(f"   Rôle     : {superviseur.get_role_display()}")
    else:
        print(f"\n→ Superviseur existant: {superviseur.email}")
    
    # 5. Créer un admin Django (optionnel)
    admin, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@example.com',
            'first_name': 'Admin',
            'last_name': 'System',
            'organization': org,
            'role': User.ROLE_SUPERVISEUR,
            'is_active': True,
            'is_staff': True,
            'is_superuser': True,
        }
    )
    if created:
        admin.set_password('admin123')
        admin.save()
        print(f"\n✓ Admin Django créé:")
        print(f"   Email    : admin@example.com")
        print(f"   Password : admin123")
        print(f"   Admin    : Oui (accès /admin/)")
    else:
        print(f"\n→ Admin existant: {admin.email}")
    
    print("\n" + "=" * 60)
    print("RÉSUMÉ - Comptes disponibles pour login")
    print("=" * 60)
    print("\n🔐 Login avec EMAIL + PASSWORD:")
    print("\n1. GESTIONNAIRE (peut créer des bulk transfers)")
    print("   curl -X POST http://localhost:8000/api/auth/login \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"email\":\"gestionnaire@cnss.bj\",\"password\":\"Pass@123\"}'")
    
    print("\n2. SUPERVISEUR (lecture seule)")
    print("   curl -X POST http://localhost:8000/api/auth/login \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"email\":\"superviseur@cnss.bj\",\"password\":\"Pass@456\"}'")
    
    print("\n3. ADMIN (accès Django admin)")
    print("   curl -X POST http://localhost:8000/api/auth/login \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\"}'")
    
    print("\n" + "=" * 60)
    print("✅ Initialisation terminée!")
    print("=" * 60)


if __name__ == '__main__':
    create_test_users()
