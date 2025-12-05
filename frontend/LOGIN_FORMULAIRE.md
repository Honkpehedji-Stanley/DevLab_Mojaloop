# 📝 QUE METTRE DANS LE FORMULAIRE DE LOGIN ?

## 🎯 Réponse simple

Dans votre formulaire de login, demandez à l'utilisateur :

### ✅ Champ 1 : **EMAIL**
- Label : "Email" ou "Adresse email"
- Type : `<input type="email">`
- Placeholder : "exemple@cnss.bj"
- Exemple de valeur : `gestionnaire@cnss.bj`

### ✅ Champ 2 : **MOT DE PASSE**  
- Label : "Mot de passe"
- Type : `<input type="password">`
- Placeholder : "Votre mot de passe"
- Exemple de valeur : `Pass@123`

---

## 📋 EXEMPLE HTML

```html
<form id="loginForm">
  <div>
    <label for="email">Email</label>
    <input 
      type="email" 
      id="email" 
      name="email" 
      placeholder="votre.email@cnss.bj"
      required
    />
  </div>

  <div>
    <label for="password">Mot de passe</label>
    <input 
      type="password" 
      id="password" 
      name="password" 
      placeholder="Mot de passe"
      required
    />
  </div>

  <button type="submit">Se connecter</button>
</form>

<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      alert('Erreur: ' + (error.non_field_errors?.[0] || 'Login échoué'));
      return;
    }
    
    const data = await response.json();
    
    // Stocker les tokens
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    alert('Connecté en tant que: ' + data.user.email);
    
    // Rediriger vers le dashboard
    window.location.href = '/dashboard';
    
  } catch (error) {
    alert('Erreur de connexion: ' + error.message);
  }
});
</script>
```

---

## ⚛️ EXEMPLE REACT

```jsx
import { useState } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.non_field_errors?.[0] || 'Login échoué');
      }

      const data = await response.json();
      
      // Stocker les tokens
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirection
      window.location.href = '/dashboard';
      
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <div>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre.email@cnss.bj"
          required
        />
      </div>

      <div>
        <label htmlFor="password">Mot de passe</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Votre mot de passe"
          required
        />
      </div>

      <button type="submit">Se connecter</button>
    </form>
  );
}

export default LoginForm;
```

---

## 🧪 VALEURS DE TEST

Pour tester rapidement, utilisez ces valeurs :

### 👨‍💼 Gestionnaire (peut créer des transferts)
- **Email :** `gestionnaire@cnss.bj`
- **Password :** `Pass@123`

### 👁️ Superviseur (lecture seule)
- **Email :** `superviseur@cnss.bj`
- **Password :** `Pass@456`

### 👑 Admin (accès complet)
- **Email :** `admin@example.com`
- **Password :** `admin123`

---

## ✅ RÉPONSE ATTENDUE

Quand le login réussit, vous recevez :

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "email": "gestionnaire@cnss.bj",
    "username": "gestionnaire",
    "role": "GESTIONNAIRE",
    "organization": "CNSS-BJ"
  }
}
```

### 📦 Que faire avec cette réponse ?

1. **Stocker les tokens :**
```javascript
localStorage.setItem('access_token', data.access);
localStorage.setItem('refresh_token', data.refresh);
```

2. **Stocker les infos utilisateur :**
```javascript
localStorage.setItem('user', JSON.stringify(data.user));
```

3. **Utiliser le token dans les requêtes suivantes :**
```javascript
const token = localStorage.getItem('access_token');

fetch('http://localhost:8000/api/bulk-transfers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
});
```

---

## ❌ ERREURS POSSIBLES

### Email ou mot de passe incorrect
```json
{
  "non_field_errors": ["Email ou mot de passe incorrect"]
}
```

### Compte désactivé
```json
{
  "non_field_errors": ["Ce compte est désactivé"]
}
```

### Champs manquants
```json
{
  "email": ["Ce champ est obligatoire."],
  "password": ["Ce champ est obligatoire."]
}
```

---

## 🎨 EXEMPLE COMPLET AVEC STYLE (Tailwind CSS)

Un exemple prêt à l'emploi se trouve dans :
```
frontend/src/pages/LoginExample.jsx
```

Pour l'utiliser :
```jsx
import Login from './pages/LoginExample';

function App() {
  return (
    <Login onLoginSuccess={(user) => {
      console.log('Utilisateur connecté:', user);
      // Rediriger vers le dashboard
    }} />
  );
}
```

---

## 📱 VERSION MOBILE-FRIENDLY

```jsx
<div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
  <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
    <h2 className="text-2xl font-bold text-center mb-6">
      Connexion
    </h2>
    
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="votre.email@cnss.bj"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mot de passe
        </label>
        <input
          type="password"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
      >
        Se connecter
      </button>
    </form>
  </div>
</div>
```

---

## 🔧 DEBUGGING

Si le login ne fonctionne pas :

### 1. Vérifier que le serveur est démarré
```bash
docker compose ps
# gateway-web doit être "Up"
```

### 2. Vérifier l'URL de l'API
```javascript
// URL correcte :
http://localhost:8000/api/auth/login

// PAS :
http://localhost:8000/api/auth/login/  (slash final)
http://localhost:8000/auth/login       (manque /api/)
```

### 3. Vérifier le Content-Type
```javascript
headers: {
  'Content-Type': 'application/json',  // ← Obligatoire !
}
```

### 4. Vérifier le format JSON
```javascript
// CORRECT :
body: JSON.stringify({
  email: "gestionnaire@cnss.bj",
  password: "Pass@123"
})

// INCORRECT :
body: {email: "...", password: "..."}  // Pas de JSON.stringify
```

### 5. Voir les erreurs dans la console
```javascript
.catch(error => {
  console.error('Erreur détaillée:', error);
  console.error('Message:', error.message);
});
```

---

## ✅ CHECKLIST

Avant de lancer votre login :

- [ ] Serveur démarré (`docker compose up -d`)
- [ ] Utilisateurs créés (`python /app/scripts/create_test_users.py`)
- [ ] URL correcte : `http://localhost:8000/api/auth/login`
- [ ] Content-Type : `application/json`
- [ ] Body avec `email` et `password`
- [ ] Gestion des erreurs dans le code
- [ ] Stockage des tokens dans localStorage

---

**Questions ?** Consultez `backend/LOGIN_GUIDE.md` pour plus de détails !
