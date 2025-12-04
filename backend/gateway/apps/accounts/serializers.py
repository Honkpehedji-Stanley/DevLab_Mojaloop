from rest_framework import serializers
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
