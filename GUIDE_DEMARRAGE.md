# 🚀 Guide de démarrage rapide - Système d'historique

## Démarrage du projet

### 1. Backend Django

```bash
cd backend/gateway

# Activer l'environnement virtuel (si existant)
source venv/bin/activate  # ou venv\Scripts\activate sur Windows

# Installer les dépendances (si nécessaire)
pip install -r requirements.txt

# Lancer les migrations
python manage.py migrate

# Lancer le serveur
python manage.py runserver
```

**Backend accessible sur** : `http://localhost:8000`

### 2. Frontend React

```bash
cd frontend

# Installer les dépendances (si nécessaire)
npm install

# Lancer le serveur de développement
npm run dev
```

**Frontend accessible sur** : `http://localhost:5174`

## 🧪 Tester les fonctionnalités

### Comptes de test disponibles

1. **Admin** :
   - Email : `admin@example.com`
   - Password : `admin123`
   - Permissions : Tout (création utilisateurs, transferts, historique)

2. **Gestionnaire** :
   - Email : `gestionnaire@cnss.bj`
   - Password : `Pass@123`
   - Permissions : Créer transferts + consulter historique

3. **Superviseur** :
   - Email : `superviseur@cnss.bj`
   - Password : `Pass@456`
   - Permissions : Consulter historique uniquement (pas de création)

### Scénarios de test

#### Scénario 1 : Consulter l'historique (GESTIONNAIRE ou SUPERVISEUR)

1. Se connecter avec `gestionnaire@cnss.bj` ou `superviseur@cnss.bj`
2. Sur le Dashboard, cliquer sur l'onglet **"Historique"**
3. Vérifier que la liste des transferts s'affiche
4. Tester les filtres :
   - Sélectionner un état (ex: "Terminé")
   - Sélectionner une plage de dates
   - Cliquer "Actualiser"
5. Tester la pagination :
   - Cliquer "Suivant" / "Précédent"

#### Scénario 2 : Voir les détails d'un transfert

1. Dans l'historique, cliquer sur **"Détails"** d'un transfert
2. Vérifier que la page de détails s'ouvre dans un nouvel onglet
3. Observer :
   - Carte récapitulatif (État, Montant, Organisation, Date)
   - 5 cartes de statistiques (Total, Réussis, Échoués, En attente, Taux de réussite)
   - Tableau des transactions individuelles
4. Cliquer **"Exporter CSV"** pour télécharger les détails

#### Scénario 3 : Vérifier les permissions (SUPERVISEUR)

1. Se connecter avec `superviseur@cnss.bj`
2. Vérifier que l'onglet **"Nouveau transfert"** est CACHÉ
3. Vérifier que l'onglet **"Historique"** est visible
4. Vérifier que les données de l'organisation s'affichent correctement

#### Scénario 4 : Créer un utilisateur (ADMIN)

1. Se connecter avec `admin@example.com`
2. Cliquer sur **"Créer un utilisateur"** dans la navbar
3. Remplir le formulaire :
   - Email : `nouveau.user@cnss.bj`
   - Prénom : `Nouveau`
   - Nom : `Utilisateur`
   - Rôle : `GESTIONNAIRE`
   - Organisation : `CNSS`
   - Téléphone : `+22912345678`
4. Soumettre le formulaire
5. Observer le mot de passe temporaire généré
6. Cliquer sur l'icône de copie pour copier le mot de passe
7. Vérifier l'email dans les logs du backend (console)

## 🔍 Tester les endpoints API directement

### Obtenir un token d'authentification

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gestionnaire@cnss.bj",
    "password": "Pass@123"
  }'
```

**Réponse** :
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 2,
    "email": "gestionnaire@cnss.bj",
    "username": "gestionnaire",
    "role": "GESTIONNAIRE",
    "organization": "CNSS",
    "is_staff": false,
    "is_superuser": false
  }
}
```

Copier la valeur de `access` pour les requêtes suivantes.

### Tester l'historique des transferts

```bash
# Historique complet (50 premiers résultats)
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8000/api/bulk-transfers/history

# Historique filtré par état
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "http://localhost:8000/api/bulk-transfers/history?state=COMPLETED"

# Historique avec plage de dates
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "http://localhost:8000/api/bulk-transfers/history?start_date=2024-01-01&end_date=2024-01-31"

# Pagination (20 résultats, à partir du 40ème)
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "http://localhost:8000/api/bulk-transfers/history?limit=20&offset=40"
```

### Tester les détails d'un transfert

```bash
# Remplacer <BULK_ID> par un ID réel de votre base de données
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8000/api/bulk-transfers/<BULK_ID>/details
```

**Réponse attendue** :
```json
{
  "id": 1,
  "bulk_id": "550e8400-e29b-41d4-a716-446655440000",
  "state": "COMPLETED",
  "payer_account": {
    "id": 1,
    "account_number": "ACC-CNSS-001",
    "account_holder_name": "CNSS Bénin"
  },
  "organization": {
    "id": 1,
    "name": "CNSS Bénin",
    "code": "CNSS"
  },
  "currency": "XOF",
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T11:00:00Z",
  "statistics": {
    "total_amount": 5000000,
    "total_count": 100,
    "completed_count": 98,
    "failed_count": 2,
    "pending_count": 0,
    "processing_count": 0,
    "success_rate": 98.0
  },
  "individual_transfers": [...]
}
```

## 📊 Créer des données de test

### Option 1 : Via le script Python

```bash
cd backend/gateway

# Exécuter le script de création de données de test
python scripts/create_test_data.py  # Si vous avez ce script
```

### Option 2 : Via Django Admin

```bash
# Créer un super utilisateur si pas déjà fait
python manage.py createsuperuser

# Accéder à l'admin
# Naviguer vers http://localhost:8000/admin
```

### Option 3 : Via le shell Django

```bash
python manage.py shell
```

```python
from apps.accounts.models import Organization, User
from apps.bulk.models import Account, BulkTransfer, IndividualTransfer
from decimal import Decimal
import uuid

# Créer une organisation
org = Organization.objects.create(
    name="Organisation Test",
    code="TEST",
    is_active=True
)

# Créer un compte payeur
account = Account.objects.create(
    organization=org,
    account_number="ACC-TEST-001",
    account_holder_name="Organisation Test",
    account_type="BUSINESS",
    currency="XOF",
    balance=1000000000,  # 10,000,000 XOF
    is_active=True
)

# Créer un transfert en masse
bulk = BulkTransfer.objects.create(
    bulk_id=str(uuid.uuid4()),
    payer_account=account,
    currency="XOF",
    total_amount=1000000,  # 10,000 XOF
    state="COMPLETED"
)

# Créer des transferts individuels
for i in range(10):
    IndividualTransfer.objects.create(
        bulk_transfer=bulk,
        transfer_id=str(uuid.uuid4()),
        amount=100000,  # 1,000 XOF
        currency="XOF",
        payee_party_identifier=f"22961234{i:04d}",
        state="COMPLETED" if i < 8 else "FAILED",
        error_code=None if i < 8 else "PAYEE_NOT_FOUND"
    )

print(f"✅ Transfert créé : {bulk.bulk_id}")
print(f"   Organisation : {org.name}")
print(f"   Compte : {account.account_number}")
print(f"   10 transactions individuelles créées")
```

## 🐛 Résolution de problèmes

### Backend ne démarre pas

```bash
# Vérifier l'environnement virtuel
python --version  # Doit être Python 3.8+

# Réinstaller les dépendances
pip install --upgrade -r requirements.txt

# Vérifier les migrations
python manage.py showmigrations
python manage.py migrate
```

### Frontend ne démarre pas

```bash
# Nettoyer et réinstaller
rm -rf node_modules package-lock.json
npm install

# Vérifier le fichier .env (si nécessaire)
cat .env  # VITE_API_URL=http://localhost:8000
```

### Erreur "No 'Access-Control-Allow-Origin'"

1. Vérifier que `CORS_ALLOW_ALL_ORIGINS = True` dans `backend/gateway/settings/dev.py`
2. Redémarrer le backend Django
3. Vérifier que le frontend fait des requêtes vers `http://localhost:8000` (pas `https`)

### Page blanche sur le frontend

1. Ouvrir la console du navigateur (F12)
2. Vérifier les erreurs JavaScript
3. Vérifier que `export default api` existe dans `src/lib/api.js`
4. Vider le cache et recharger (Ctrl+Shift+R)

### "Aucun transfert trouvé"

1. Vérifier que des transferts existent dans la base de données
2. Vérifier que l'utilisateur a une organisation assignée
3. Vérifier que les transferts appartiennent à la même organisation
4. Essayer sans filtres (retirer état et dates)

## 📝 Checklist de vérification

- [ ] Backend démarre sur `http://localhost:8000`
- [ ] Frontend démarre sur `http://localhost:5174`
- [ ] Login fonctionne avec `gestionnaire@cnss.bj`
- [ ] Onglet "Historique" visible et charge les données
- [ ] Filtres (état, dates) fonctionnent
- [ ] Bouton "Détails" ouvre la page de détails
- [ ] Page de détails affiche statistiques et transactions
- [ ] Export CSV télécharge un fichier
- [ ] Login avec `superviseur@cnss.bj` cache l'onglet "Nouveau transfert"
- [ ] Login avec `admin@example.com` affiche le bouton "Créer un utilisateur"
- [ ] Création d'utilisateur fonctionne et envoie un email (visible dans logs)

## 🎉 Prochaines étapes

1. **Tester avec des données réelles** :
   - Importer un fichier CSV de pensions
   - Vérifier que le transfert s'exécute
   - Observer l'historique se mettre à jour

2. **Configurer l'email en production** :
   - Modifier `EMAIL_BACKEND` dans `settings/prod.py`
   - Configurer SMTP (Gmail, SendGrid, etc.)
   - Tester l'envoi d'emails réels

3. **Améliorer l'UI** :
   - Ajouter des graphiques avec Chart.js
   - Implémenter des notifications toast
   - Ajouter un mode sombre

4. **Performance** :
   - Ajouter un cache Redis pour l'historique
   - Optimiser les requêtes SQL (select_related, prefetch_related)
   - Implémenter le lazy loading pour les grands tableaux

Bon développement ! 🚀
