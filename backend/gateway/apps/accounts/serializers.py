from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from .models import User, Organization


class OrganizationSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les organisations."""
    
    class Meta:
        model = Organization
        fields = ['id', 'name', 'code', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    """Sérialiseur pour les utilisateurs."""
    
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_code = serializers.CharField(source='organization.code', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'phone_number', 
            'organization', 'organization_name', 'organization_code',
            'is_active', 'last_login', 'date_joined'
        ]
        read_only_fields = ['id', 'last_login', 'date_joined']
        extra_kwargs = {
            'password': {'write_only': True}
        }


class UserProfileSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le profil utilisateur connecté."""
    
    organization = OrganizationSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    permissions = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'phone_number', 
            'organization', 'permissions',
            'last_login', 'last_login_ip', 'date_joined'
        ]
        read_only_fields = fields
    
    def get_permissions(self, obj):
        """Retourne les permissions de l'utilisateur."""
        return {
            'can_create_transfers': obj.can_create_transfers(),
            'can_view_transfers': obj.can_view_transfers(),
        }


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer JWT personnalisé qui utilise l'email au lieu du username.
    Permet de se connecter avec email + password.
    """
    username_field = User.USERNAME_FIELD
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ajouter le champ email
        self.fields['email'] = serializers.EmailField(required=True)
        # Retirer le champ username de l'affichage
        self.fields.pop('username', None)
    
    @classmethod
    def get_token(cls, user):
        """Générer le token JWT pour l'utilisateur."""
        token = super().get_token(user)
        # Ajouter des claims personnalisés si nécessaire
        token['email'] = user.email
        token['role'] = user.role
        return token
    
    def validate(self, attrs):
        """
        Authentifie l'utilisateur avec son email au lieu du username.
        """
        email = attrs.get('email')
        password = attrs.get('password')
        
        if not email or not password:
            raise serializers.ValidationError('Email et mot de passe requis')
        
        # Chercher l'utilisateur par email
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Email ou mot de passe incorrect')
        
        # Vérifier le mot de passe
        if not user.check_password(password):
            raise serializers.ValidationError('Email ou mot de passe incorrect')
        
        # Vérifier que le compte est actif
        if not user.is_active:
            raise serializers.ValidationError('Ce compte est désactivé')
        
        # Générer les tokens manuellement
        refresh = self.get_token(user)
        
        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'role': user.role,
                'organization': user.organization.code if user.organization else None,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            }
        }
        
        # Mettre à jour last_login si configuré
        if hasattr(self, 'update_last_login') or True:
            from django.contrib.auth.models import update_last_login
            update_last_login(None, user)
        
        
        return data


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """
    Serializer pour la création d'utilisateurs par un administrateur.
    Génère un mot de passe temporaire et envoie un email au nouvel utilisateur.
    """
    organization_id = serializers.IntegerField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name', 'role', 
            'organization_id', 'phone_number', 'username'
        ]
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
            'role': {'required': True},
        }
    
    def validate_email(self, value):
        """Vérifier que l'email n'existe pas déjà."""
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un utilisateur avec cet email existe déjà.")
        return value
    
    def validate_organization_id(self, value):
        """Vérifier que l'organisation existe."""
        try:
            Organization.objects.get(id=value)
        except Organization.DoesNotExist:
            raise serializers.ValidationError("Organisation introuvable.")
        return value
    
    def validate_role(self, value):
        """Vérifier que le rôle est valide."""
        if value not in [User.ROLE_GESTIONNAIRE, User.ROLE_SUPERVISEUR]:
            raise serializers.ValidationError("Rôle invalide. Choisissez GESTIONNAIRE ou SUPERVISEUR.")
        return value
    
    def create(self, validated_data):
        """
        Créer un utilisateur avec un mot de passe temporaire généré automatiquement.
        Le mot de passe est retourné dans le contexte pour l'envoyer par email.
        """
        import secrets
        import string
        
        # Générer un mot de passe temporaire sécurisé (12 caractères)
        alphabet = string.ascii_letters + string.digits + "!@#$%&*"
        temp_password = ''.join(secrets.choice(alphabet) for i in range(12))
        
        # Générer un username à partir de l'email si non fourni
        if 'username' not in validated_data or not validated_data['username']:
            validated_data['username'] = validated_data['email'].split('@')[0]
        
        # Extraire organization_id
        organization_id = validated_data.pop('organization_id')
        
        # Créer l'utilisateur
        user = User.objects.create_user(
            **validated_data,
            password=temp_password,
            organization_id=organization_id,
            is_active=True
        )
        
        # Stocker le mot de passe temporaire dans l'instance pour pouvoir l'envoyer par email
        user.temp_password = temp_password
        
        return user
