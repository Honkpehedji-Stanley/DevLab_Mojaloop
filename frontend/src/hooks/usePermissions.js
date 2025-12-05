/**
 * Hook personnalisé pour gérer les permissions utilisateur
 */
import { useState, useEffect } from 'react';

export const usePermissions = () => {
    const [permissions, setPermissions] = useState({
        canCreateTransfers: false,
        canViewTransfers: false,
        isAdmin: false,
        isGestionnaire: false,
        isSuperviseur: false,
        role: null,
    });

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        setPermissions({
            canCreateTransfers: user.role === 'GESTIONNAIRE',
            canViewTransfers: true, // Tous les utilisateurs authentifiés peuvent voir
            isAdmin: user.is_staff || user.is_superuser || false,
            isGestionnaire: user.role === 'GESTIONNAIRE',
            isSuperviseur: user.role === 'SUPERVISEUR',
            role: user.role || null,
        });
    }, []);

    return permissions;
};

export default usePermissions;
