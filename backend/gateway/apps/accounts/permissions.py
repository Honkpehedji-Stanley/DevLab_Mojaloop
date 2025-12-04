from rest_framework import permissions


class IsGestionnaire(permissions.BasePermission):
    """
    Permission accordée uniquement aux gestionnaires.
    Utilisé pour la création de transferts.
    """
    message = "Seuls les gestionnaires peuvent effectuer cette action."
    
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.can_create_transfers()
        )


class IsSameOrganization(permissions.BasePermission):
    """
    Permission accordée si l'objet appartient à la même organisation que l'utilisateur.
    Utilisé pour isoler les données entre organisations.
    """
    message = "Vous n'avez pas accès aux données d'une autre organisation."
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Si l'objet a une organisation directe
        if hasattr(obj, 'organization'):
            return obj.organization == request.user.organization
        
        # Si l'objet a un payer_account qui a une organisation
        if hasattr(obj, 'payer_account') and hasattr(obj.payer_account, 'organization'):
            return obj.payer_account.organization == request.user.organization
        
        return False


class IsActiveUser(permissions.BasePermission):
    """
    Permission accordée uniquement aux utilisateurs actifs.
    """
    message = "Votre compte est désactivé."
    
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.is_active
        )
