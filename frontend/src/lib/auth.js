/**
 * Utilitaires d'authentification - Login avec EMAIL
 * API: http://localhost:8000/api/auth/
 */

const API_URL = 'http://localhost:8000/api/auth';

/**
 * Connexion avec email + password
 * @param {string} email - Email de l'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Promise<{access: string, refresh: string, user: object}>}
 */
export async function login(email, password) {
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.non_field_errors?.[0] || 'Erreur de connexion');
    }

    const data = await response.json();

    // Stocker les tokens
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
}

/**
 * Récupérer le profil de l'utilisateur connecté
 * @returns {Promise<object>}
 */
export async function getProfile() {
    const token = localStorage.getItem('access_token');

    if (!token) {
        throw new Error('Non authentifié');
    }

    const response = await fetch(`${API_URL}/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Token expiré, essayer de le rafraîchir
            await refreshToken();
            return getProfile(); // Réessayer
        }
        throw new Error('Erreur lors de la récupération du profil');
    }

    return response.json();
}

/**
 * Rafraîchir l'access token
 * @returns {Promise<{access: string, refresh: string}>}
 */
export async function refreshToken() {
    const refresh = localStorage.getItem('refresh_token');

    if (!refresh) {
        throw new Error('Aucun refresh token disponible');
    }

    const response = await fetch(`${API_URL}/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh })
    });

    if (!response.ok) {
        // Refresh token invalide, déconnecter
        logout();
        throw new Error('Session expirée, veuillez vous reconnecter');
    }

    const data = await response.json();

    // Mettre à jour les tokens
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);

    return data;
}

/**
 * Déconnexion
 * @returns {Promise<void>}
 */
export async function logout() {
    const token = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');

    if (token && refresh) {
        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh })
            });
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        }
    }

    // Supprimer les tokens du localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
}

/**
 * Vérifier si l'utilisateur est authentifié
 * @returns {boolean}
 */
export function isAuthenticated() {
    return !!localStorage.getItem('access_token');
}

/**
 * Récupérer l'utilisateur stocké
 * @returns {object|null}
 */
export function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

/**
 * Vérifier si l'utilisateur a le rôle GESTIONNAIRE
 * @returns {boolean}
 */
export function isGestionnaire() {
    const user = getCurrentUser();
    return user?.role === 'GESTIONNAIRE';
}

/**
 * Vérifier si l'utilisateur a le rôle SUPERVISEUR
 * @returns {boolean}
 */
export function isSuperviseur() {
    const user = getCurrentUser();
    return user?.role === 'SUPERVISEUR';
}

/**
 * Intercepteur fetch pour ajouter automatiquement le token
 * @param {string} url - URL de la requête
 * @param {object} options - Options fetch
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');

    if (!token) {
        throw new Error('Non authentifié');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    let response = await fetch(url, { ...options, headers });

    // Si 401, essayer de rafraîchir le token
    if (response.status === 401) {
        try {
            await refreshToken();
            const newToken = localStorage.getItem('access_token');
            headers['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, { ...options, headers });
        } catch (error) {
            // Impossible de rafraîchir, rediriger vers login
            logout();
            window.location.href = '/login';
            throw error;
        }
    }

    return response;
}

// Export des comptes de test pour faciliter les démos
export const TEST_ACCOUNTS = {
    gestionnaire: {
        email: 'gestionnaire@cnss.bj',
        password: 'Pass@123',
        role: 'GESTIONNAIRE',
        description: 'Peut créer des transferts groupés'
    },
    superviseur: {
        email: 'superviseur@cnss.bj',
        password: 'Pass@456',
        role: 'SUPERVISEUR',
        description: 'Consultation uniquement'
    },
    admin: {
        email: 'admin@example.com',
        password: 'admin123',
        role: 'SUPERVISEUR',
        description: 'Accès admin Django'
    }
};
