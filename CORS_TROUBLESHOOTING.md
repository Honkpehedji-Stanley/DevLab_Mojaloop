# 🔧 Guide de résolution - Erreur CORS

## ❌ Erreur que vous voyez :

```
Access to XMLHttpRequest at 'http://localhost:8000/api/bulk-transfers' 
from origin 'http://localhost:5173' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ Configuration CORS actuelle (CORRECTE)

### Backend Django (`gateway/settings/dev.py`)
```python
DEBUG = True
CORS_ALLOW_ALL_ORIGINS = True  # ✅ Accepte toutes les origines en dev
CORS_ALLOW_CREDENTIALS = True  # ✅ Permet les cookies/credentials
```

### Frontend Axios (`src/lib/api.js`)
```javascript
// ✅ Intercepteur configuré - ajoute automatiquement le token JWT
axios.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});
```

## 🐛 Causes possibles de l'erreur

### 1. **Utilisateur non authentifié** (PLUS PROBABLE)

Si vous n'êtes pas connecté ou que votre token JWT est expiré :

```javascript
// ❌ Requête sans token ou avec token invalide
POST /api/bulk-transfers
→ Backend répond : 401 Unauthorized
→ Navigateur affiche erreur CORS (comportement normal)
```

**Solution :**
```javascript
// ✅ Se connecter d'abord
const { access } = await api.login('email@example.com', 'password');
// Puis faire la requête (le token sera automatiquement ajouté)
await api.uploadCSV(file);
```

### 2. **Route protégée par permissions**

La route `/api/bulk-transfers` requiert :
- ✅ `IsAuthenticated` - Token JWT valide
- ✅ `IsGestionnaire` - Rôle GESTIONNAIRE (pas SUPERVISEUR)

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGestionnaire])
def create_bulk_transfers(request):
    # ...
```

**Vérifiez votre rôle :**
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('Role:', user.role); // Doit être "GESTIONNAIRE"
```

### 3. **Token expiré**

Les tokens JWT expirent après 8 heures. Vérifiez :

```javascript
// Dans la console du navigateur
const token = localStorage.getItem('accessToken');
if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = new Date(payload.exp * 1000);
    console.log('Token expire le:', exp);
    console.log('Expiré?', exp < new Date());
}
```

### 4. **Serveur backend down**

```bash
# Vérifier que le backend tourne
docker compose -f backend/docker-compose.yml ps web
# STATUS devrait être "Up" (healthy)
```

## ✅ Comment tester correctement

### Test 1: Vérifier la connexion

```javascript
// Dans la console du navigateur (F12)
const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('accessToken');
console.log('Utilisateur:', user);
console.log('Token présent:', !!token);
console.log('Rôle:', user?.role);
```

### Test 2: Tester l'endpoint avec curl

```bash
# 1. Se connecter
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"gestionnaire@cnss.bj","password":"Pass@123"}' \
  | jq -r '.access')

# 2. Tester la route avec le token
curl -X POST http://localhost:8000/api/bulk-transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: http://localhost:5173" \
  -F "file=@test.csv" \
  -F "payer_account=1"
```

### Test 3: Vérifier les headers CORS (preflight)

```bash
curl -X OPTIONS http://localhost:8000/api/bulk-transfers \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -I
```

**Devrait retourner :**
```
HTTP/1.1 200 OK
access-control-allow-origin: http://localhost:5173
access-control-allow-credentials: true
access-control-allow-methods: DELETE, GET, OPTIONS, PATCH, POST, PUT
```

## 🔄 Workflow de débogage

1. **Ouvrir la console du navigateur** (F12 → Network)
2. **Essayer la requête** (upload CSV)
3. **Inspecter la requête :**
   - ✅ `Authorization: Bearer eyJ...` présent ?
   - ✅ Réponse du serveur : `200 OK` ou `401 Unauthorized` ?
   - ✅ En-têtes CORS dans la réponse ?

4. **Si 401 Unauthorized :**
   - → Vous n'êtes pas connecté ou token expiré
   - → Solution : Se reconnecter

5. **Si 403 Forbidden :**
   - → Votre rôle n'a pas la permission
   - → Vérifiez que vous êtes GESTIONNAIRE (pas SUPERVISEUR)

6. **Si vraiment aucun header CORS :**
   - → Redémarrer le backend : `docker compose restart web`
   - → Vider le cache du navigateur : Ctrl+Shift+R

## 📝 Résumé

L'erreur CORS que vous voyez est **NORMALE** et **ATTENDUE** dans ces cas :

✅ Requête sans authentification → 401 → Pas de headers CORS
✅ Rôle insuffisant (SUPERVISEUR au lieu de GESTIONNAIRE) → 403
✅ Token expiré → 401

**Pour résoudre :**
1. Connectez-vous avec un compte GESTIONNAIRE
2. Vérifiez que le token est valide (< 8h)
3. Rechargez la page après connexion
4. Essayez à nouveau l'upload

**La configuration CORS est correcte** - le problème vient de l'authentification, pas de CORS ! 🎯
