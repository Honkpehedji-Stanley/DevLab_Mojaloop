# Frontend - Plateforme de Paiement des Pensions CNSS

Interface web React pour la gestion des paiements de pensions.

## Technologies utilisées

- **React 18** - Bibliothèque UI
- **Vite** - Build tool et dev server
- **React Router v6** - Routing
- **Tailwind CSS** - Framework CSS utility-first
- **Lucide React** - Bibliothèque d'icônes
- **Axios** - Client HTTP
- **React Hooks** - Gestion d'état moderne

## Structure du projet

```
frontend/
├── src/
│   ├── components/           # Composants réutilisables
│   │   ├── layout/          # Composants de mise en page
│   │   │   ├── Layout.jsx   # Layout principal
│   │   │   └── Navbar.jsx   # Barre de navigation
│   │   └── ui/              # Composants UI
│   │       ├── Button.jsx   # Bouton personnalisé
│   │       ├── Card.jsx     # Carte de contenu
│   │       ├── FileUpload.jsx # Upload de fichiers
│   │       ├── Input.jsx    # Champ de saisie
│   │       ├── Table.jsx    # Tableau de données
│   │       └── Pagination.jsx # Pagination
│   ├── pages/               # Pages de l'application
│   │   ├── Login.jsx        # Page de connexion
│   │   ├── Dashboard.jsx    # Ancienne version du tableau de bord
│   │   ├── DashboardNew.jsx # Tableau de bord principal
│   │   └── admin/           # Pages d'administration
│   │       └── CreateUser.jsx # Création d'utilisateur
│   ├── hooks/               # Custom hooks React
│   │   ├── useAuth.js       # Hook d'authentification
│   │   └── usePermissions.js # Hook de permissions
│   ├── lib/                 # Utilitaires et configuration
│   │   ├── api.js           # Client API avec Axios
│   │   └── utils.js         # Fonctions utilitaires
│   ├── App.jsx              # Composant racine
│   ├── main.jsx             # Point d'entrée
│   └── index.css            # Styles globaux
├── public/                  # Fichiers statiques
├── index.html               # Template HTML
├── vite.config.js           # Configuration Vite
├── tailwind.config.js       # Configuration Tailwind
├── postcss.config.js        # Configuration PostCSS
└── package.json             # Dépendances npm
```

## Installation et démarrage

### Installation des dépendances

```bash
cd frontend
npm install
```

### Démarrage en développement

```bash
npm run dev
```

L'application sera accessible sur http://localhost:5174

### Build pour production

```bash
npm run build
```

Les fichiers de production seront générés dans le dossier `dist/`.

### Prévisualiser le build de production

```bash
npm run preview
```

## Configuration

### Variables d'environnement

Créer un fichier `.env` à la racine du frontend :

```env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=CNSS Pensions
```

### Configuration de l'API

Le fichier `src/lib/api.js` configure le client Axios avec :
- URL de base de l'API backend
- Intercepteurs JWT pour l'authentification automatique
- Gestion automatique du rafraîchissement des tokens
- Gestion des erreurs globales

## Pages et fonctionnalités

### Page de connexion (`/login`)

**Fichier** : `src/pages/Login.jsx`

- Formulaire d'authentification par email et mot de passe
- Validation des champs
- Messages d'erreur
- Redirection automatique après connexion
- Stockage sécurisé des tokens JWT

### Tableau de bord (`/`)

**Fichier** : `src/pages/DashboardNew.jsx`

Deux onglets principaux :

#### 1. Nouveau transfert
- Upload de fichier CSV
- Validation du format
- Traitement en temps réel
- Barre de progression
- Liste des résultats avec :
  - Recherche par nom, téléphone, ID
  - Filtre par statut (SUCCESS, FAILED, PENDING)
  - Pagination (8 éléments par page)
- Bouton d'annulation
- Téléchargement du rapport

#### 2. Historique
- Liste de tous les transferts
- Filtres par :
  - État (PENDING, PROCESSING, COMPLETED, FAILED)
  - Date de début
  - Date de fin
- Pagination
- Bouton "Actualiser"
- Vue détaillée dans un modal popup avec :
  - Informations générales du bulk
  - Statistiques (total, complétés, échoués, taux de succès)
  - Liste de toutes les transactions individuelles

### Création d'utilisateur (`/admin/create-user`)

**Fichier** : `src/pages/admin/CreateUser.jsx`

- Accessible uniquement aux administrateurs
- Formulaire de création avec :
  - Email
  - Prénom et nom
  - Rôle (Gestionnaire, Superviseur)
  - Organisation
  - Numéro de téléphone (optionnel)
- Génération automatique d'un mot de passe temporaire
- Envoi d'email de bienvenue
- Affichage du mot de passe généré

## Composants UI réutilisables

### Button

```jsx
import { Button } from './components/ui/Button';

<Button variant="primary" size="md" onClick={handleClick}>
  Cliquez-moi
</Button>
```

**Variants** : `primary`, `secondary`, `ghost`, `danger`
**Sizes** : `sm`, `md`, `lg`

### Card

```jsx
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';

<Card>
  <CardHeader>
    <CardTitle>Titre</CardTitle>
  </CardHeader>
  <CardContent>
    Contenu de la carte
  </CardContent>
</Card>
```

### FileUpload

```jsx
import { FileUpload } from './components/ui/FileUpload';

<FileUpload
  onFileSelect={handleFileSelect}
  accept=".csv"
  maxSize={5242880} // 5MB
/>
```

### Table

```jsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/Table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Colonne 1</TableHead>
      <TableHead>Colonne 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Donnée 1</TableCell>
      <TableCell>Donnée 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Pagination

```jsx
import { Pagination } from './components/ui/Pagination';

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
/>
```

## Hooks personnalisés

### useAuth

Gère l'authentification de l'utilisateur.

```jsx
import useAuth from './hooks/useAuth';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();

  return (
    <div>
      {isAuthenticated ? (
        <p>Bonjour {user.first_name}</p>
      ) : (
        <button onClick={() => login(email, password)}>Connexion</button>
      )}
    </div>
  );
}
```

**Retourne** :
- `user` : Objet utilisateur connecté
- `login(email, password)` : Fonction de connexion
- `logout()` : Fonction de déconnexion
- `isAuthenticated` : Boolean indiquant si l'utilisateur est connecté

### usePermissions

Gère les permissions basées sur le rôle de l'utilisateur.

```jsx
import usePermissions from './hooks/usePermissions';

function MyComponent() {
  const { canCreateTransfers, canViewTransfers, isAdmin } = usePermissions();

  return (
    <div>
      {canCreateTransfers && (
        <button>Créer un transfert</button>
      )}
    </div>
  );
}
```

**Retourne** :
- `canCreateTransfers` : Boolean (true pour GESTIONNAIRE)
- `canViewTransfers` : Boolean (true pour tous)
- `isAdmin` : Boolean (true pour is_staff)

## API Client

Le fichier `src/lib/api.js` expose toutes les fonctions pour interagir avec le backend :

### Authentification

```javascript
import api from './lib/api';

// Connexion
const { access, refresh, user } = await api.login(email, password);

// Rafraîchir le token
const { access } = await api.refreshToken(refreshToken);

// Récupérer le profil
const user = await api.getProfile();
```

### Transferts

```javascript
// Créer un bulk transfer
const result = await api.createBulkTransfer(formData);

// Statut en temps réel
const status = await api.getBulkTransferStatus(bulkId);

// Historique
const { results, total } = await api.getBulkTransfersHistory({
  state: 'COMPLETED',
  limit: 50,
  offset: 0
});

// Détails
const details = await api.getBulkTransferDetails(bulkId);
```

### Administration

```javascript
// Créer un utilisateur
const newUser = await api.createUser({
  email: 'nouveau@cnss.bj',
  first_name: 'Nouveau',
  last_name: 'Utilisateur',
  role: 'GESTIONNAIRE',
  organization_id: 1
});

// Liste des organisations
const organizations = await api.getOrganizations();
```

## Styling avec Tailwind CSS

Le projet utilise Tailwind CSS avec une configuration personnalisée dans `tailwind.config.js`.

### Couleurs personnalisées

```javascript
colors: {
  primary: {
    50: '#eff6ff',
    // ... autres nuances
    600: '#2563eb',
  },
  secondary: {
    50: '#f8fafc',
    // ... autres nuances
    900: '#0f172a',
  }
}
```

### Classes utilitaires communes

```jsx
// Cards avec ombre
<div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-6">

// Boutons primaires
<button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700">

// Badges de statut
<span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
```

## Gestion d'état

Le projet utilise les hooks React natifs pour la gestion d'état :

- `useState` : État local des composants
- `useEffect` : Effets de bord (appels API, etc.)
- `useRef` : Références DOM et valeurs persistantes
- Context API : Partage de l'état d'authentification

### Exemple de gestion d'état

```jsx
const [loading, setLoading] = useState(false);
const [data, setData] = useState([]);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await api.getData();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);
```

## Bonnes pratiques

1. **Composants** : Un composant par fichier
2. **Nommage** : PascalCase pour les composants, camelCase pour les fonctions
3. **Props** : Déstructurer les props dans les paramètres
4. **État** : Minimiser l'état, utiliser des composants contrôlés
5. **Effets** : Nettoyer les effets (abonnements, timers)
6. **Performance** : Utiliser React.memo pour les composants lourds
7. **Accessibilité** : Utiliser les attributs ARIA appropriés

## Debugging

### React DevTools

Installer l'extension React DevTools pour Chrome/Firefox pour inspecter les composants.

### Logs API

Activer les logs API dans `src/lib/api.js` :

```javascript
axios.interceptors.request.use((config) => {
  console.log('API Request:', config);
  return config;
});
```

### Vite Dev Server

Les erreurs apparaissent directement dans le navigateur avec un overlay.

## Build et déploiement

### Build de production

```bash
npm run build
```

Optimisations appliquées :
- Minification du code
- Tree shaking
- Code splitting
- Optimisation des images
- Génération de source maps

### Servir les fichiers

Les fichiers dans `dist/` peuvent être servis par :
- Nginx
- Apache
- Serveur Node.js
- Services cloud (Vercel, Netlify, AWS S3, etc.)

### Configuration Nginx

```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    root /var/www/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Tests (à implémenter)

Structure recommandée pour les tests :

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
```

Exemple de test :

```javascript
import { render, screen } from '@testing-library/react';
import { Button } from './components/ui/Button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

## Performance

### Optimisations appliquées

1. **Lazy loading** : Chargement différé des pages
2. **Code splitting** : Division du code en chunks
3. **Memoization** : React.memo pour composants lourds
4. **Debouncing** : Sur les champs de recherche
5. **Pagination** : Limitation des données affichées

### Lighthouse Score cible

- Performance : > 90
- Accessibility : > 95
- Best Practices : > 90
- SEO : > 90

## Support

Pour toute question concernant le frontend :
- Vérifier la console du navigateur
- Consulter la documentation React
- Vérifier les logs Vite dans le terminal
