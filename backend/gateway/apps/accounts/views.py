from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .serializers import UserProfileSerializer


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
