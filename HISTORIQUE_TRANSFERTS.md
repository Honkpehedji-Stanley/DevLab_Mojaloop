# Système d'historique des transferts en masse - Documentation

## 📋 Vue d'ensemble

Ce document décrit le système complet d'historique des transferts en masse avec gestion des permissions basée sur les rôles.

## 🎯 Fonctionnalités implémentées

### 1. Backend - Endpoints API

#### GET `/api/bulk-transfers/history`
- **Description** : Liste l'historique des transferts en masse de l'organisation de l'utilisateur
- **Permission** : Authentification requise (GESTIONNAIRE et SUPERVISEUR)
- **Filtres disponibles** :
  - `state` : État du transfert (PENDING, PROCESSING, COMPLETED, FAILED, PARTIALLY_COMPLETED)
  - `start_date` : Date de début (format YYYY-MM-DD)
  - `end_date` : Date de fin (format YYYY-MM-DD)
  - `limit` : Nombre de résultats (max 200, défaut 50)
  - `offset` : Décalage pour pagination (défaut 0)
- **Réponse** :
```json
{
  "total": 150,
  "count": 50,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": 123,
      "bulk_id": "bulk-uuid-xxx",
      "state": "COMPLETED",
      "total_amount": 1000000,
      "currency": "XOF",
      "transfers_count": 50,
      "completed_count": 48,
      "failed_count": 2,
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T11:00:00Z"
    }
  ]
}
```

#### GET `/api/bulk-transfers/<bulk_id>/details`
- **Description** : Détails complets d'un transfert en masse spécifique
- **Permission** : Authentification requise + vérification de l'organisation
- **Sécurité** : Vérifie que l'utilisateur appartient à la même organisation que le transfert
- **Réponse** :
```json
{
  "id": 123,
  "bulk_id": "bulk-uuid-xxx",
  "state": "COMPLETED",
  "payer_account": {
    "id": 1,
    "account_number": "ACC-001",
    "account_holder_name": "Organisation XYZ"
  },
  "organization": {
    "id": 1,
    "name": "Organisation XYZ",
    "code": "ORG-001"
  },
  "currency": "XOF",
  "created_at": "2024-01-15T10:30:00Z",
  "completed_at": "2024-01-15T11:00:00Z",
  "statistics": {
    "total_amount": 1000000,
    "total_count": 50,
    "completed_count": 48,
    "failed_count": 2,
    "pending_count": 0,
    "processing_count": 0,
    "success_rate": 96.0
  },
  "individual_transfers": [
    {
      "id": 1,
      "transfer_id": "transfer-uuid-xxx",
      "amount": 20000,
      "currency": "XOF",
      "payee_party_identifier": "229XXXXXXXX",
      "state": "COMPLETED",
      "error_code": null,
      "created_at": "2024-01-15T10:30:00Z",
      "completed_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

### 2. Frontend - Pages et composants

#### Dashboard amélioré (`DashboardNew.jsx`)

**Onglets conditionnels** :
- **"Nouveau transfert"** : Visible uniquement pour les GESTIONNAIRE (permissions.canCreateTransfers)
- **"Historique"** : Visible pour tous les utilisateurs authentifiés

**Filtres disponibles** :
- État (dropdown) : Tous / En attente / En cours / Terminé / Échoué / Partiellement terminé
- Date début (date picker)
- Date fin (date picker)
- Bouton "Actualiser" avec indicateur de chargement

**Tableau d'historique** :
- Colonnes : ID Transfert, Date, Montant, Transactions, État, Actions
- Affichage du nombre de transactions (total, réussis, échoués)
- Badge coloré pour l'état
- Bouton "Détails" qui ouvre la page de détails dans un nouvel onglet

**Pagination** :
- Affichage "X - Y sur Z"
- Boutons Précédent / Suivant
- Gestion automatique des limites et offsets

#### Page de détails (`TransferDetails.jsx`)

**En-tête** :
- Bouton retour
- ID complet du transfert en masse
- Boutons "Actualiser" et "Exporter CSV"

**Carte récapitulatif** :
- État du transfert
- Montant total
- Organisation
- Date de création

**Statistiques (5 cartes)** :
- Total de transactions
- Réussis (vert)
- Échoués (rouge)
- En attente (jaune)
- Taux de réussite (%)

**Tableau des transactions individuelles** :
- Colonnes : ID Transaction, Bénéficiaire, Montant, État, Code Erreur, Date
- Icônes d'état animées (spinner pour "En cours")
- Mise en évidence des codes d'erreur en rouge

**Export CSV** :
- Génère un fichier CSV avec toutes les transactions
- Nom du fichier : `transfert_<bulk_id>_details.csv`
- Colonnes : ID Transaction, Bénéficiaire, Montant, État, Code Erreur, Date Création, Date Fin

### 3. Hook de permissions (`usePermissions`)

**Retourne** :
```javascript
{
  canCreateTransfers: boolean,    // true si GESTIONNAIRE
  canViewTransfers: boolean,      // true si authentifié
  isAdmin: boolean,               // true si is_staff ou is_superuser
  isGestionnaire: boolean,        // true si role === 'GESTIONNAIRE'
  isSuperviseur: boolean,         // true si role === 'SUPERVISEUR'
  role: string | null             // Le rôle de l'utilisateur
}
```

**Usage** :
```jsx
import usePermissions from '../hooks/usePermissions';

const MyComponent = () => {
  const { canCreateTransfers, isAdmin } = usePermissions();
  
  return (
    <>
      {canCreateTransfers && <Button>Créer un transfert</Button>}
      {isAdmin && <Link to="/admin/users/create">Créer un utilisateur</Link>}
    </>
  );
};
```

## 🔒 Sécurité et permissions

### Backend

1. **Filtrage par organisation** :
   - Tous les endpoints filtrent automatiquement par `request.user.organization`
   - Un utilisateur ne peut voir QUE les transferts de son organisation
   - Vérification supplémentaire dans `get_bulk_transfer_details` (retourne 403 si organisation différente)

2. **Permissions requises** :
   - `list_bulk_transfers` : `IsAuthenticated` (GESTIONNAIRE et SUPERVISEUR)
   - `get_bulk_transfer_details` : `IsAuthenticated` + vérification organisation

3. **Protection CORS** :
   - `CORS_ALLOW_ALL_ORIGINS = True` en développement
   - À configurer pour production avec domaines spécifiques

### Frontend

1. **Visibilité conditionnelle** :
   - Bouton "Nouveau transfert" caché pour SUPERVISEUR
   - Bouton "Créer un utilisateur" caché pour non-admins
   - Navigation basée sur les permissions du hook `usePermissions`

2. **Données utilisateur** :
   - Stockées dans `localStorage` après login
   - Incluent : `id`, `email`, `username`, `role`, `organization`, `is_staff`, `is_superuser`
   - Rechargées au démarrage de l'application via `AuthContext`

## 🚀 Routes complètes

### Backend
```
POST   /api/auth/login                           # Login avec email
POST   /api/auth/admin/users                     # Créer un utilisateur (admin)
GET    /api/organizations                        # Liste des organisations
GET    /api/bulk-transfers/history               # Historique des transferts
GET    /api/bulk-transfers/<bulk_id>/details     # Détails d'un transfert
POST   /api/bulk-transfers                       # Créer un transfert (GESTIONNAIRE)
```

### Frontend
```
/login                          # Page de connexion
/                              # Dashboard (historique)
/admin/users/create            # Créer un utilisateur (admin uniquement)
/transfers/:bulkId             # Détails d'un transfert
```

## 📊 Flux de données

### 1. Chargement de l'historique
```
User ouvre Dashboard
  → useEffect déclenche loadHistory()
  → api.getBulkTransfersHistory(filters)
  → GET /api/bulk-transfers/history?state=COMPLETED&limit=50
  → Backend filtre par organization
  → Retourne {total, results}
  → Frontend affiche tableau avec pagination
```

### 2. Affichage des détails
```
User clique "Détails"
  → Navigation vers /transfers/:bulkId
  → useEffect déclenche loadDetails()
  → api.getBulkTransferDetails(bulkId)
  → GET /api/bulk-transfers/:bulkId/details
  → Backend vérifie organization (403 si différent)
  → Retourne {bulk_id, statistics, individual_transfers}
  → Frontend affiche cartes statistiques + tableau
```

### 3. Export CSV
```
User clique "Exporter CSV"
  → exportToCSV() extrait details.individual_transfers
  → Génère CSV avec headers + rows
  → Crée Blob et télécharge fichier
  → Nom: transfert_<bulk_id>_details.csv
```

## 🧪 Tests recommandés

### Backend
```bash
# Historique sans filtre
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/bulk-transfers/history

# Historique avec filtres
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/bulk-transfers/history?state=COMPLETED&limit=10"

# Détails d'un transfert
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/bulk-transfers/<bulk_id>/details
```

### Frontend
1. **Connexion GESTIONNAIRE** :
   - Vérifier onglets "Nouveau transfert" et "Historique" visibles
   - Vérifier tableau d'historique se charge
   - Tester filtres (état, dates)
   - Tester pagination
   - Cliquer "Détails" → nouvelle page avec transactions

2. **Connexion SUPERVISEUR** :
   - Vérifier onglet "Nouveau transfert" CACHÉ
   - Vérifier onglet "Historique" visible
   - Vérifier accès aux mêmes données que GESTIONNAIRE
   - Vérifier export CSV fonctionne

3. **Connexion ADMIN** :
   - Vérifier bouton "Créer un utilisateur" dans navbar
   - Vérifier accès historique
   - Tester création d'utilisateur

## 📈 Améliorations futures

1. **Backend** :
   - Ajouter cache Redis pour historique
   - Webhook notifications pour changements d'état
   - API de recherche par numéro de téléphone bénéficiaire
   - Export PDF avec graphiques

2. **Frontend** :
   - Graphiques de statistiques (Chart.js)
   - Notifications temps réel (WebSocket)
   - Recherche textuelle dans historique
   - Filtres sauvegardés (préférences utilisateur)
   - Mode sombre

3. **Performance** :
   - Pagination côté serveur optimisée (curseur)
   - Lazy loading pour tableaux volumineux
   - Service Worker pour cache offline

## 🐛 Dépannage

### "Aucun transfert trouvé"
- Vérifier que l'utilisateur a une organisation assignée
- Vérifier que des transferts existent dans la base de données pour cette organisation
- Vérifier les filtres appliqués (état, dates)

### "Accès refusé" sur détails
- L'utilisateur essaie d'accéder à un transfert d'une autre organisation
- Vérifier que `bulk_id` est correct
- Vérifier que l'utilisateur est bien authentifié

### Page blanche
- Vérifier console navigateur pour erreurs JavaScript
- Vérifier que `export default api` existe dans `api.js`
- Vérifier que tous les composants sont correctement importés

### CORS errors
- En développement : `CORS_ALLOW_ALL_ORIGINS = True` dans `dev.py`
- En production : Configurer `CORS_ALLOWED_ORIGINS` avec domaines spécifiques
- Vérifier que le backend répond avec status 200 (pas 401/403)

## 📝 Fichiers modifiés

### Backend
- `apps/bulk/views.py` : Ajout de `list_bulk_transfers` et `get_bulk_transfer_details`
- `apps/bulk/urls.py` : Routes pour history et details
- `apps/accounts/serializers.py` : `EmailTokenObtainPairSerializer` inclut `is_staff` et `is_superuser`

### Frontend
- `src/lib/api.js` : Méthodes `getBulkTransfersHistory` et `getBulkTransferDetails`
- `src/hooks/usePermissions.js` : Hook de permissions (NOUVEAU)
- `src/pages/DashboardNew.jsx` : Dashboard avec onglets et historique (NOUVEAU)
- `src/pages/TransferDetails.jsx` : Page de détails avec export (NOUVEAU)
- `src/App.jsx` : Route `/transfers/:bulkId` ajoutée

## ✅ Statut d'implémentation

- ✅ Backend endpoints (history + details)
- ✅ Filtrage par organisation
- ✅ Frontend API methods
- ✅ Hook de permissions
- ✅ Dashboard avec onglets conditionnels
- ✅ Page de détails avec statistiques
- ✅ Export CSV
- ✅ Pagination
- ✅ Filtres (état, dates)
- ✅ Visibilité basée sur rôle
