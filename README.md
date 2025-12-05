# Plateforme de Paiement des Pensions CNSS

Système de gestion et de distribution des paiements de pensions en masse via le protocole Mojaloop.

## Vue d'ensemble

Cette plateforme permet à la Caisse Nationale de Sécurité Sociale (CNSS) du Bénin de gérer efficacement les paiements de pensions aux bénéficiaires via des transferts groupés (bulk transfers) utilisant le protocole Mojaloop.

### Fonctionnalités principales

- **Gestion des utilisateurs** : Système d'authentification avec rôles (Gestionnaire, Superviseur)
- **Transferts en masse** : Import de fichiers CSV pour traiter plusieurs paiements simultanément
- **Suivi en temps réel** : Progression des transferts avec statistiques détaillées
- **Historique complet** : Consultation de tous les transferts avec filtres et recherche
- **Rapports détaillés** : Vue détaillée de chaque lot de transferts avec toutes les transactions individuelles
- **Sécurité** : Authentification JWT, permissions par rôle, isolation des données par organisation

## Architecture technique

### Backend
- **Framework** : Django 5.1 avec Django REST Framework
- **Base de données** : SQLite (développement) / PostgreSQL (production recommandé)
- **Authentification** : JWT avec Simple JWT
- **Conteneurisation** : Docker avec docker-compose
- **API** : RESTful avec documentation Swagger/OpenAPI

### Frontend
- **Framework** : React 18 avec Vite
- **Routing** : React Router v6
- **Styling** : Tailwind CSS
- **Icônes** : Lucide React
- **HTTP Client** : Axios avec intercepteurs JWT

### Intégration Mojaloop
- SDK Scheme Adapter pour la communication avec le hub Mojaloop
- Support des transferts groupés (bulk transfers)
- Gestion des callbacks et confirmations de paiement

## Structure du projet

```
DevLab_Mojaloop/
├── backend/                    # Application Django
│   ├── gateway/               # Code source Django
│   │   ├── apps/             # Applications Django
│   │   │   ├── accounts/     # Gestion utilisateurs et organisations
│   │   │   ├── bulk/         # Transferts en masse
│   │   │   └── transactions/ # Transactions individuelles
│   │   └── gateway/          # Configuration Django
│   ├── configs/              # Configurations (TTK, etc.)
│   ├── scripts/              # Scripts utilitaires
│   └── docker-compose.yml    # Configuration Docker
├── frontend/                  # Application React
│   ├── src/                  # Code source React
│   │   ├── components/       # Composants réutilisables
│   │   ├── pages/           # Pages de l'application
│   │   ├── hooks/           # Custom hooks
│   │   └── lib/             # Utilitaires et API
│   └── server/              # Serveur Node.js (optionnel)
└── k6-load-test-script.js    # Tests de charge K6
```

## Installation et démarrage

### Prérequis

- Docker et Docker Compose
- Node.js 18+ et npm (pour le développement frontend)
- Python 3.11+ (pour le développement backend sans Docker)

### Démarrage rapide avec Docker

1. **Cloner le repository**
   ```bash
   git clone https://github.com/Honkpehedji-Stanley/DevLab_Mojaloop.git
   cd DevLab_Mojaloop
   ```

2. **Démarrer le backend**
   ```bash
   cd backend
   docker-compose up -d
   ```
   Le backend sera accessible sur http://localhost:8000

3. **Démarrer le frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Le frontend sera accessible sur http://localhost:5174

### Configuration initiale

Les utilisateurs par défaut sont créés automatiquement :

- **Administrateur** : admin@example.com / admin123
- **Gestionnaire** : gestionnaire@cnss.bj / Pass@123
- **Superviseur** : superviseur@cnss.bj / Pass@456

Un compte de paiement avec 1 milliard XOF est créé pour l'organisation CNSS Bénin.

## Utilisation

### 1. Connexion
Connectez-vous avec l'un des comptes utilisateur selon votre rôle.

### 2. Import de fichiers CSV
Les gestionnaires peuvent importer des fichiers CSV contenant les paiements à effectuer.

Format du CSV :
```csv
type_id,valeur_id,devise,montant
MSISDN,22997000001,XOF,50000
MSISDN,22997000002,XOF,75000
```

### 3. Suivi des transferts
- Visualisation en temps réel de la progression
- Barre de progression affichant le pourcentage de complétion
- Liste des transactions avec leur statut (Complété, Échoué, En attente)

### 4. Consultation de l'historique
- Accès à tous les transferts effectués
- Filtres par état, date
- Recherche par ID de transaction, nom ou numéro de téléphone
- Vue détaillée de chaque lot avec toutes les transactions

## API Documentation

La documentation complète de l'API est disponible via Swagger UI :
- Swagger UI : http://localhost:8000/swagger/
- ReDoc : http://localhost:8000/redoc/

### Endpoints principaux

- `POST /api/auth/login` - Authentification
- `POST /api/bulk-transfers` - Créer un transfert en masse
- `GET /api/bulk-transfers/history` - Historique des transferts
- `GET /api/bulk-transfers/{bulk_id}/details` - Détails d'un transfert
- `GET /api/bulk-transfers/{bulk_id}/status` - Statut en temps réel

## Développement

### Backend

```bash
cd backend/gateway
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Mode développement
npm run build      # Build production
npm run preview    # Prévisualiser le build
```

### Tests

```bash
# Tests backend
cd backend/gateway
python manage.py test

# Tests de charge K6
k6 run k6-load-test-script.js
```

## Déploiement en production

### Recommandations

1. **Base de données** : Migrer vers PostgreSQL
2. **Variables d'environnement** : Configurer les secrets (JWT_SECRET, DATABASE_URL, etc.)
3. **HTTPS** : Utiliser un reverse proxy (Nginx) avec certificats SSL
4. **CORS** : Restreindre les origines autorisées
5. **Email** : Configurer un serveur SMTP pour les notifications
6. **Logs** : Mise en place de monitoring (Sentry, CloudWatch, etc.)
7. **Backups** : Sauvegardes régulières de la base de données

### Build du frontend

```bash
cd frontend
npm run build
# Les fichiers de production seront dans le dossier dist/
```

## Sécurité

- Authentification JWT avec tokens d'accès (8h) et de rafraîchissement (7 jours)
- Permissions basées sur les rôles (RBAC)
- Isolation des données par organisation
- Validation des entrées utilisateur
- Protection CSRF pour les formulaires
- Rate limiting sur les endpoints sensibles (recommandé)

## Support et contribution

Pour toute question ou problème :
- Créer une issue sur GitHub
- Contacter l'équipe de développement

## Licence

Propriétaire - CNSS Bénin

## Auteurs

Développé pour la Caisse Nationale de Sécurité Sociale du Bénin.
