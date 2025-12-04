# Gateway Django Mojaloop - Bulk Transfers

API REST Django pour la gestion de transferts groupés via le protocole Mojaloop. Cette gateway permet de créer et monitorer des bulk transfers en temps réel avec le SDK Scheme Adapter Mojaloop.

## Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React/JS)    │
└────────┬────────┘
         │ HTTP/SSE
         ▼
┌─────────────────┐      ┌──────────────┐
│  Django Gateway │◄────►│    Redis     │
│   (Port 8000)   │      │  (Broker)    │
└────────┬────────┘      └──────────────┘
         │
         ├──► Celery Worker (tâches async)
         │
         ├──► SQLite / PostgreSQL
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  SDK Adapter    │◄────►│  Mock Hub    │
│  (Port 4001)    │      │  (Port 4040) │
└─────────────────┘      └──────────────┘
```

## Fonctionnalités

### Endpoints Principaux

1. **POST /api/bulk-transfers**
   - Crée un bulk transfer à partir d'un fichier CSV
   - Réserve les fonds sur le compte payeur
   - Lance le traitement asynchrone via Celery

2. **GET /api/bulk-transfers/{id}/stream** (SSE)
   - Stream temps réel de la progression du bulk transfer
   - Mises à jour automatiques toutes les secondes
   - Fermeture automatique à la fin du traitement

3. **GET /api/bulk-transfers/{id}/status**
   - Récupère l'état actuel du bulk transfer
   - Détails de tous les transferts individuels

### Formats CSV Supportés

**Format standard:**
```csv
transferId,amount,currency,partyIdType,partyIdentifier
tx-001,10000,XOF,MSISDN,22890123456
tx-002,5000,XOF,MSISDN,22890654321
```

**Format payment list (transferId auto-généré):**
```csv
type_id,valeur_id,devise,montant
MSISDN,22890123456,XOF,10000
MSISDN,22890654321,XOF,5000
```

## Installation

### Prérequis

- Docker & Docker Compose
- Git

### Démarrage rapide

```bash
# Cloner le repository
git clone <repository-url>
cd backend

# Créer le fichier .env depuis le template
cp .env.example .env

# Éditer le .env et configurer DJANGO_SECRET_KEY
nano .env

# Démarrer tous les services
docker compose up -d

# Vérifier que les services sont actifs
docker compose ps

# Créer un compte payeur de test
docker exec -w /app/gateway gateway-web python manage.py shell -c "
from apps.bulk.models import Account
Account.objects.create(
    party_id_type='MSISDN',
    party_identifier='123456789',
    account_id='ACC-123456789',
    balance=1000000000,
    reserved=0
)
"
```

### Accès aux services

- Django API: http://localhost:8000
- Swagger UI: http://localhost:8000/swagger/
- SDK Adapter: http://localhost:4001
- Mock Hub: http://localhost:4040
- Redis: localhost:6379

## Utilisation

### Workflow complet en 3 étapes

```bash
# 1. Créer un bulk transfer
curl -X POST http://localhost:8000/api/bulk-transfers \
  -F "file=@transfers.csv" \
  -F "payer_account=ACC-123456789" \
  -F "callback_url=http://localhost:8000/api/transfers"

# Réponse: {"bulkTransferId": "bulk-xxx", "state": "PENDING"}

# 2. Monitorer en temps réel (SSE)
curl -N http://localhost:8000/api/bulk-transfers/bulk-xxx/stream

# Stream de progression:
# data: {"state": "PROCESSING", "completed": 10, "total": 90, "progress_percent": 11.11}
# data: {"state": "PROCESSING", "completed": 45, "total": 90, "progress_percent": 50.0}
# data: {"state": "COMPLETED", "completed": 90, "total": 90, "progress_percent": 100.0}

# 3. Récupérer le statut final détaillé
curl http://localhost:8000/api/bulk-transfers/bulk-xxx/status | jq
```

### Intégration Frontend (JavaScript)

```javascript
// Étape 1: Créer le bulk transfer
const formData = new FormData();
formData.append('file', csvFile);
formData.append('payer_account', 'ACC-123456789');
formData.append('callback_url', 'http://localhost:8000/api/transfers');

const response = await fetch('http://localhost:8000/api/bulk-transfers', {
  method: 'POST',
  body: formData
});
const { bulkTransferId } = await response.json();

// Étape 2: Stream SSE pour updates en temps réel
const eventSource = new EventSource(
  `http://localhost:8000/api/bulk-transfers/${bulkTransferId}/stream`
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`Progression: ${data.progress_percent}%`);
  updateProgressBar(data.completed, data.total);
};

eventSource.addEventListener('done', (event) => {
  const data = JSON.parse(event.data);
  console.log('Transfert terminé:', data.state);
  eventSource.close();
  
  // Étape 3: Récupérer les détails finaux
  fetchFinalStatus(bulkTransferId);
});

eventSource.addEventListener('error', (event) => {
  console.error('Erreur SSE');
  eventSource.close();
});
```

## Configuration

### Variables d'environnement (.env)

```bash
# Django
DJANGO_SECRET_KEY=change-me-in-production
DJANGO_DEBUG=True
DJANGO_SETTINGS_MODULE=gateway.settings.dev

# Base de données
USE_SQLITE=True  # False pour PostgreSQL

# PostgreSQL (si USE_SQLITE=False)
POSTGRES_DB=gateway
POSTGRES_USER=gateway
POSTGRES_PASSWORD=secure-password
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Mojaloop SDK Adapter
SCHEME_ADAPTER_URL=http://mojaloop-connector-load-test:4001

# Celery + Redis
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0
```

## Développement

### Structure du projet

```
backend/
├── docker-compose.yml          # Orchestration des services
├── Dockerfile                  # Image Django + Celery
├── .env.example                # Template de configuration
├── gateway/
│   ├── manage.py               # CLI Django
│   ├── requirements.txt        # Dépendances Python
│   ├── apps/
│   │   └── bulk/
│   │       ├── models.py       # Account, BulkTransfer, IndividualTransfer
│   │       ├── views.py        # Endpoints principaux
│   │       ├── sse_views.py    # Server-Sent Events
│   │       └── tasks.py        # Tâches Celery
│   └── gateway/
│       ├── settings/
│       │   ├── base.py         # Configuration de base
│       │   └── dev.py          # Configuration développement
│       └── celery.py           # Configuration Celery
└── secrets/                    # Clés JWS Mojaloop
```

### Commandes utiles

```bash
# Logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f web
docker compose logs -f celery

# Redémarrer un service
docker compose restart web

# Shell Django
docker exec -it -w /app/gateway gateway-web python manage.py shell

# Migrations
docker exec -w /app/gateway gateway-web python manage.py makemigrations
docker exec -w /app/gateway gateway-web python manage.py migrate

# Créer un superuser
docker exec -it -w /app/gateway gateway-web python manage.py createsuperuser

# Arrêter tous les services
docker compose down

# Nettoyer les volumes
docker compose down -v
```

## Tests

```bash
# Tester la création d'un compte
docker exec -w /app/gateway gateway-web python manage.py shell -c "
from apps.bulk.models import Account
acc = Account.objects.create(
    party_id_type='MSISDN',
    party_identifier='999888777',
    account_id='TEST-ACC',
    balance=5000000,
    reserved=0
)
print(f'Créé: {acc}')
"

# Tester le workflow complet
bash test-workflow.sh
```

## Modèles de données

### Account
```python
party_id_type: str       # Type d'identifiant (MSISDN, etc.)
party_identifier: str    # Numéro de téléphone, etc.
account_id: str          # Identifiant unique du compte
balance: int             # Solde en unités mineures (centimes)
reserved: int            # Montant réservé pour transferts en cours
```

### BulkTransfer
```python
bulk_id: str             # Identifiant unique (bulk-xxxx)
payer_account: Account   # Compte payeur
total_amount: int        # Montant total en unités mineures
currency: str            # Devise (XOF, NGN, etc.)
state: str               # PENDING, PROCESSING, COMPLETED, FAILED, PARTIALLY_COMPLETED
created_at: datetime     # Date de création
```

### IndividualTransfer
```python
transfer_id: str                  # Identifiant unique du transfert
bulk: BulkTransfer                # Bulk parent
payee_party_id_type: str          # Type d'identifiant du bénéficiaire
payee_party_identifier: str       # Identifiant du bénéficiaire
amount: int                       # Montant en unités mineures
currency: str                     # Devise
status: str                       # PENDING, COMPLETED, FAILED
completed_at: datetime            # Date de complétion
```

## Sécurité

### Production

- Changer `DJANGO_SECRET_KEY` par une clé forte aléatoire
- Définir `DJANGO_DEBUG=False`
- Utiliser PostgreSQL au lieu de SQLite
- Configurer HTTPS/TLS
- Activer l'authentification dans REST_FRAMEWORK
- Restreindre ALLOWED_HOSTS

### Secrets

Ne jamais commit:
- `.env`
- `secrets/`
- `db.sqlite3`
- `__pycache__/`

## Dépannage

### Le bulk reste en PENDING
- Vérifier que Celery est actif: `docker compose logs celery`
- Vérifier Redis: `docker compose logs redis`
- Vérifier le SDK adapter: `curl http://localhost:4001`

### Erreur "payer account not found"
- Créer un compte avec la commande ci-dessus
- Vérifier que `account_id` correspond

### SSE ne stream pas
- Désactiver le buffering nginx si utilisé
- Vérifier les headers `Cache-Control: no-cache`

## Licence

Propriétaire

## Support

Pour toute question, consulter:
- Swagger UI: http://localhost:8000/swagger/
- Documentation Mojaloop: https://mojaloop.io
- Guide d'intégration frontend: `FRONTEND_INTEGRATION_GUIDE.md`
