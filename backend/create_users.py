#!/usr/bin/env python
import os
import sys
import django

# Ajouter le chemin du projet
sys.path.insert(0, '/app/gateway')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gateway.settings.dev')
django.setup()

from apps.accounts.models import User, Organization

# Récupérer l'organisation CNSS
try:
    org = Organization.objects.get(code='CNSS')
except Organization.DoesNotExist:
    print("❌ Organisation CNSS introuvable")
    sys.exit(1)

# Supprimer tous les utilisateurs existants
deleted_count = User.objects.all().count()
User.objects.all().delete()
print(f"🗑️  {deleted_count} utilisateurs supprimés\n")

# Liste des utilisateurs avec noms réels béninois
users_data = [
    ('admin@cnss.bj', 'Admin@2025', 'Administrateur', 'Système', 'SUPERVISEUR', True, True, '+22997000000'),
    ('marie.akassou@cnss.bj', 'Marie@2025', 'Marie', 'AKASSOU', 'GESTIONNAIRE', False, False, '+22997111111'),
    ('jules.dossou@cnss.bj', 'Jules@2025', 'Jules', 'DOSSOU', 'GESTIONNAIRE', False, False, '+22997222222'),
    ('rachel.houessou@cnss.bj', 'Rachel@2025', 'Rachel', 'HOUESSOU', 'SUPERVISEUR', False, False, '+22997333333'),
    ('franck.kougbeadjo@cnss.bj', 'Franck@2025', 'Franck', 'KOUGBEADJO', 'SUPERVISEUR', False, False, '+22997444444'),
    ('sylvie.agossa@cnss.bj', 'Sylvie@2025', 'Sylvie', 'AGOSSA', 'GESTIONNAIRE', False, False, '+22997555555'),
]

# Créer les utilisateurs
for email, pwd, fn, ln, role, staff, su, phone in users_data:
    user = User.objects.create_user(
        username=email,
        email=email,
        password=pwd,
        first_name=fn,
        last_name=ln,
        role=role,
        organization=org,
        phone_number=phone,
        is_staff=staff,
        is_superuser=su
    )
    print(f"✅ {fn} {ln} ({email}) - {role}")

print(f"\n✅ Total: {User.objects.count()} utilisateurs créés avec succès!")
