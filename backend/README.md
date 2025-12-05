# Backend - Plateforme de Paiement des Pensions

API REST Django pour la gestion des paiements de pensions via Mojaloop.

## Architecture

### Technologies utilisées

- **Django 5.1** - Framework web Python
- **Django REST Framework** - Framework pour API REST
- **Simple JWT** - Authentification JWT
- **SQLite** - Base de données (développement)
- **Gunicorn** - Serveur WSGI pour production
- **Docker** - Conteneurisation
- **Swagger/OpenAPI** - Documentation API

### Structure du code

```
backend/
├── gateway/                    # Projet Django principal
│   ├── apps/                  # Applications Django
│   │   ├── accounts/         # Gestion utilisateurs, organisations
│   │   │   ├── models.py     # Models User, Organization
│   │   │   ├── views.py      # Endpoints auth, profil, admin
│   │   │   ├── serializers.py # Sérialiseurs JWT, User
│   │   │   └── permissions.py # Permissions personnalisées
│   │   ├── bulk/             # Transferts en masse
│   │   │   ├── models.py     # Models Account, BulkTransfer, IndividualTransfer
│   │   │   ├── views.py      # Endpoints bulk transfers
│   │   │   ├── tasks.py      # Tâches Celery (orchestration)
│   │   │   └── serializers.py # Sérialiseurs API
│   │   └── transactions/     # Transactions individuelles
│   │       ├── models.py     # Models Transfer, Quote
│   │       └── views.py      # Endpoints transactions
│   └── gateway/              # Configuration Django
│       ├── settings/         # Settings par environnement
│       │   ├── base.py       # Configuration commune
│       │   ├── dev.py        # Configuration développement
│       │   └── prod.py       # Configuration production
│       ├── urls.py           # URLs principales
│       └── wsgi.py           # Point d'entrée WSGI
├── configs/                   # Fichiers de configuration
│   └── ttk/                  # Configuration Testing Toolkit
├── scripts/                   # Scripts utilitaires
│   ├── entrypoint.sh         # Script de démarrage Docker
│   ├── migrate.sh            # Script de migration
│   └── wait-for-db.sh        # Attente base de données
├── docker-compose.yml        # Configuration Docker Compose
├── Dockerfile                # Image Docker
└── requirements.txt          # Dépendances Python
```

## Modèles de données

### Organization
Représente une organisation (CNSS, partenaires).
- `code` : Code unique de l'organisation
- `name` : Nom complet
- `is_active` : Statut actif/inactif

### User
Utilisateur de la plateforme (hérite de AbstractUser Django).
- `email` : Email (utilisé pour la connexion)
- `first_name`, `last_name` : Nom et prénom
- `role` : GESTIONNAIRE ou SUPERVISEUR
- `organization` : Organisation de rattachement
- `phone_number` : Numéro de téléphone

### Account
Compte de paiement associé à une organisation.
- `account_id` : Identifiant unique du compte
- `organization` : Organisation propriétaire
- `party_id_type` : Type d'identifiant (MSISDN, PERSONAL_ID, etc.)
- `party_identifier` : Identifiant de la partie
- `balance` : Solde en centimes
- `reserved` : Montant réservé pour transferts en cours

### BulkTransfer
Transfert groupé contenant plusieurs transactions.
- `bulk_id` : Identifiant unique du bulk
- `payer_account` : Compte payeur
- `total_amount` : Montant total en centimes
- `currency` : Devise (XOF par défaut)
- `state` : PENDING, PROCESSING, COMPLETED, FAILED
- `created_at` : Date de création

### IndividualTransfer
Transaction individuelle au sein d'un bulk.
- `transfer_id` : Identifiant unique de la transaction
- `bulk` : Référence au bulk parent
- `payee_party_id_type` : Type d'identifiant bénéficiaire
- `payee_party_identifier` : Identifiant bénéficiaire
- `payee_account` : Compte bénéficiaire (si trouvé)
- `amount` : Montant en centimes
- `status` : PENDING, COMPLETED, FAILED
- `completed_at` : Date de complétion

## API Endpoints

### Authentification

#### POST /api/auth/login
Connexion avec email et mot de passe.

**Request:**
```json
{
  "email": "gestionnaire@cnss.bj",
  "password": "Pass@123"
}
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJ...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJ...",
  "user": {
    "id": 1,
    "email": "gestionnaire@cnss.bj",
    "first_name": "Gestionnaire",
    "last_name": "CNSS",
    "role": "GESTIONNAIRE"
  }
}
```

#### POST /api/auth/token/refresh
Rafraîchir le token d'accès.

#### GET /api/auth/profile
Récupérer le profil de l'utilisateur connecté.

### Transferts en masse

#### POST /api/bulk-transfers
Créer un transfert en masse via fichier CSV.

**Headers:** `Authorization: Bearer <token>`

**Form Data:**
- `file`: Fichier CSV (multipart/form-data)

**Format CSV:**
```csv
type_id,valeur_id,devise,montant
MSISDN,22997000001,XOF,50000
MSISDN,22997000002,XOF,75000
```

**Response:**
```json
{
  "bulkTransferId": "bulk-abc123",
  "state": "PENDING"
}
```

#### GET /api/bulk-transfers/history
Liste des transferts de l'organisation.

**Query Parameters:**
- `state`: Filtrer par état (PENDING, COMPLETED, FAILED)
- `start_date`: Date début (YYYY-MM-DD)
- `end_date`: Date fin (YYYY-MM-DD)
- `limit`: Nombre de résultats (max 200, défaut 50)
- `offset`: Offset pour pagination

**Response:**
```json
{
  "total": 100,
  "count": 50,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": 1,
      "bulk_id": "bulk-abc123",
      "state": "COMPLETED",
      "total_amount": 1250000,
      "currency": "XOF",
      "transfers_count": 10,
      "completed_count": 9,
      "failed_count": 1,
      "created_at": "2025-12-05T10:30:00Z"
    }
  ]
}
```

#### GET /api/bulk-transfers/{bulk_id}/details
Détails complets d'un transfert avec toutes les transactions.

**Response:**
```json
{
  "bulk_id": "bulk-abc123",
  "state": "COMPLETED",
  "total_amount": 1250000,
  "currency": "XOF",
  "payer_account": {
    "account_id": "ACC-CNSS-001",
    "party_id_type": "MSISDN",
    "party_identifier": "22997000001"
  },
  "organization": {
    "name": "CNSS Bénin",
    "code": "CNSS"
  },
  "statistics": {
    "total": 10,
    "completed": 9,
    "failed": 1,
    "pending": 0,
    "processing": 0,
    "success_rate": 90.0
  },
  "created_at": "2025-12-05T10:30:00Z",
  "individual_transfers": [
    {
      "id": 1,
      "transfer_id": "transfer-001",
      "amount": 50000,
      "currency": "XOF",
      "payee_party_id_type": "MSISDN",
      "payee_party_identifier": "22997000001",
      "status": "COMPLETED",
      "completed_at": "2025-12-05T10:31:00Z"
    }
  ]
}
```

#### GET /api/bulk-transfers/{bulk_id}/status
Statut en temps réel avec progression.

**Response:**
```json
{
  "bulkTransferId": "bulk-abc123",
  "state": "PROCESSING",
  "total": 10,
  "completed": 7,
  "failed": 0,
  "pending": 3,
  "progress_percent": 70.0,
  "individualTransfers": [...]
}
```

### Administration (Admin uniquement)

#### POST /api/admin/users/create
Créer un nouvel utilisateur.

**Request:**
```json
{
  "email": "nouveau@cnss.bj",
  "first_name": "Nouveau",
  "last_name": "Utilisateur",
  "role": "GESTIONNAIRE",
  "organization_id": 1,
  "phone_number": "22997000000"
}
```

**Response:**
```json
{
  "user": {...},
  "temporary_password": "Gen3r4t3dP@ss",
  "email_sent": true,
  "message": "Utilisateur créé avec succès. Un email a été envoyé."
}
```

## Installation et développement

### Avec Docker (recommandé)

```bash
cd backend
docker-compose up -d
```

Services démarrés :
- `gateway-web` : API Django (port 8000)
- `ml-testing-toolkit` : Simulateur Mojaloop (port 5000)

### Sans Docker

```bash
cd backend/gateway

# Créer environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Installer dépendances
pip install -r requirements.txt

# Appliquer migrations
python manage.py migrate

# Créer superutilisateur (optionnel)
python manage.py createsuperuser

# Démarrer serveur
python manage.py runserver
```

### Variables d'environnement

Créer un fichier `.env` dans `backend/gateway/` :

```env
# Django
SECRET_KEY=votre-secret-key-tres-securisee
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database (pour PostgreSQL en production)
DATABASE_URL=postgres://user:password@localhost:5432/dbname

# JWT
JWT_ACCESS_TOKEN_LIFETIME=480  # 8 heures en minutes
JWT_REFRESH_TOKEN_LIFETIME=10080  # 7 jours en minutes

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-password

# Mojaloop
SCHEME_ADAPTER_URL=http://mojaloop-connector-load-test:4001
```

## Commandes utiles

```bash
# Migrations
python manage.py makemigrations
python manage.py migrate

# Shell Django
python manage.py shell

# Tests
python manage.py test

# Créer un utilisateur via shell
python manage.py shell
>>> from apps.accounts.models import User, Organization
>>> org = Organization.objects.get(code='CNSS')
>>> User.objects.create_user(
...     email='test@cnss.bj',
...     password='password123',
...     first_name='Test',
...     last_name='User',
...     role='GESTIONNAIRE',
...     organization=org
... )

# Vérifier les comptes
>>> from apps.bulk.models import Account
>>> Account.objects.all()
```

## Permissions

### IsGestionnaire
Utilisateur avec role='GESTIONNAIRE'. Peut créer des transferts.

### IsSuperviseur
Utilisateur avec role='SUPERVISEUR'. Lecture seule.

### IsAdminUser
Utilisateur avec is_staff=True. Accès complet administration.

### IsSameOrganization
Vérifie que l'utilisateur appartient à la même organisation que la ressource.

## Tests

```bash
# Tous les tests
python manage.py test

# Tests d'une app spécifique
python manage.py test apps.bulk

# Tests avec coverage
coverage run --source='.' manage.py test
coverage report
```

## Logs

Les logs sont configurés dans `settings/base.py`. En production, configurer un système de logging centralisé (Sentry, CloudWatch, etc.).

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': '/var/log/django/app.log',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': 'INFO',
    },
}
```

## Migration vers PostgreSQL

Pour la production, remplacer SQLite par PostgreSQL :

1. Installer psycopg2 :
   ```bash
   pip install psycopg2-binary
   ```

2. Modifier `settings/prod.py` :
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': 'cnss_pensions',
           'USER': 'cnss_user',
           'PASSWORD': 'secure_password',
           'HOST': 'localhost',
           'PORT': '5432',
       }
   }
   ```

3. Exécuter les migrations :
   ```bash
   python manage.py migrate
   ```

## Sécurité en production

1. Définir `DEBUG=False`
2. Utiliser une SECRET_KEY forte et unique
3. Configurer ALLOWED_HOSTS correctement
4. Activer HTTPS uniquement
5. Configurer CORS pour le domaine frontend uniquement
6. Utiliser PostgreSQL avec SSL
7. Configurer les headers de sécurité (HSTS, CSP, etc.)
8. Rate limiting sur les endpoints sensibles
9. Monitoring et alertes actifs

## Support

Pour toute question technique concernant le backend :
- Consulter la documentation Swagger : http://localhost:8000/swagger/
- Vérifier les logs Docker : `docker logs gateway-web`
- Consulter la documentation Django REST Framework
