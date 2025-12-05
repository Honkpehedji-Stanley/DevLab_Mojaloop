from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .serializers import UserProfileSerializer, EmailTokenObtainPairSerializer, AdminUserCreateSerializer, OrganizationSerializer
from .emails import send_welcome_email
from .models import Organization


class EmailTokenObtainPairView(TokenObtainPairView):
    """
    Vue de connexion personnalisée qui utilise l'email au lieu du username.
    
    **Exemple de requête:**
    ```json
    {
        "email": "gestionnaire@cnss.bj",
        "password": "votre_mot_de_passe"
    }
    ```
    
    **Réponse:**
    ```json
    {
        "access": "eyJ0eXAiOiJKV1QiLCJ...",
        "refresh": "eyJ0eXAiOiJKV1QiLCJ...",
        "user": {
            "id": 1,
            "email": "gestionnaire@cnss.bj",
            "username": "gestionnaire",
            "role": "GESTIONNAIRE",
            "organization": "CNSS-BJ"
        }
    }
    ```
    """
    serializer_class = EmailTokenObtainPairSerializer


def get_client_ip(request):
    """Récupère l'adresse IP du client."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


@swagger_auto_schema(
    method='get',
    operation_description="""
    Récupère les informations du profil utilisateur connecté.
    
    **Retour:**
    - Informations personnelles
    - Organisation
    - Rôle et permissions
    - Historique de connexion
    """,
    responses={
        200: UserProfileSerializer,
        401: 'Non authentifié'
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Retourne le profil de l'utilisateur connecté."""
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data)


@swagger_auto_schema(
    method='post',
    operation_description="""
    Déconnexion de l'utilisateur.
    Blackliste le refresh token pour empêcher son réutilisation.
    
    **Body:**
    ```json
    {
        "refresh": "refresh_token_here"
    }
    ```
    """,
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=['refresh'],
        properties={
            'refresh': openapi.Schema(
                type=openapi.TYPE_STRING,
                description='Refresh token à blacklister'
            ),
        },
    ),
    responses={
        200: 'Déconnexion réussie',
        400: 'Token invalide'
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Déconnecte l'utilisateur en blacklistant le refresh token."""
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'error': 'Le refresh token est requis'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        token = RefreshToken(refresh_token)
        token.blacklist()
        
        return Response(
            {'message': 'Déconnexion réussie'}, 
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {'error': 'Token invalide ou expiré'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@swagger_auto_schema(
    method='post',
    operation_description="""
    Créer un nouveau utilisateur (réservé aux administrateurs).
    
    **Permissions requises:** Administrateur (is_staff ou is_superuser)
    
    **Fonctionnalités:**
    - Génère automatiquement un mot de passe temporaire sécurisé
    - Envoie un email de bienvenue avec les identifiants
    - Retourne les informations de l'utilisateur créé + le mot de passe temporaire
    
    **Body:**
    ```json
    {
        "email": "nouveau.user@cnss.bj",
        "first_name": "Prénom",
        "last_name": "Nom",
        "role": "GESTIONNAIRE",
        "organization_id": 1,
        "phone_number": "+22997000000"
    }
    ```
    
    **Réponse:**
    ```json
    {
        "user": {
            "id": 5,
            "email": "nouveau.user@cnss.bj",
            "first_name": "Prénom",
            "last_name": "Nom",
            "role": "GESTIONNAIRE",
            "organization": {...}
        },
        "temporary_password": "aB3$xY9!mN2@",
        "email_sent": true,
        "message": "Utilisateur créé avec succès. Un email a été envoyé."
    }
    ```
    """,
    request_body=AdminUserCreateSerializer,
    responses={
        201: openapi.Response(
            description='Utilisateur créé avec succès',
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'user': openapi.Schema(type=openapi.TYPE_OBJECT),
                    'temporary_password': openapi.Schema(type=openapi.TYPE_STRING),
                    'email_sent': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'message': openapi.Schema(type=openapi.TYPE_STRING),
                }
            )
        ),
        400: 'Données invalides',
        403: 'Permission refusée (admin requis)'
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_create_user(request):
    """
    Créer un nouvel utilisateur (admin seulement).
    Génère un mot de passe temporaire et envoie un email de bienvenue.
    """
    serializer = AdminUserCreateSerializer(data=request.data)
    
    if serializer.is_valid():
        # Créer l'utilisateur
        user = serializer.save()
        
        # Récupérer le mot de passe temporaire (stocké dans l'instance)
        temp_password = user.temp_password
        
        # Envoyer l'email de bienvenue
        email_sent = send_welcome_email(user, temp_password)
        
        # Préparer la réponse avec le profil complet de l'utilisateur
        from .serializers import UserProfileSerializer
        user_data = UserProfileSerializer(user).data
        
        return Response({
            'user': user_data,
            'temporary_password': temp_password,
            'email_sent': email_sent,
            'message': 'Utilisateur créé avec succès. Un email a été envoyé.' if email_sent else 
                      'Utilisateur créé avec succès. Erreur lors de l\'envoi de l\'email.'
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@swagger_auto_schema(
    method='get',
    operation_description="Liste toutes les organisations actives",
    responses={200: OrganizationSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_organizations(request):
    """Retourne la liste de toutes les organisations actives."""
    organizations = Organization.objects.filter(is_active=True)
    serializer = OrganizationSerializer(organizations, many=True)
    return Response(serializer.data)

