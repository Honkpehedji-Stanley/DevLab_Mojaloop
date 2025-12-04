from django.contrib import admin
from .models import Organization, User


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'code']
    ordering = ['name']


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'organization', 'role', 'is_active', 'last_login']
    list_filter = ['role', 'is_active', 'organization']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['organization', 'username']
    
    fieldsets = (
        ('Informations personnelles', {
            'fields': ('username', 'email', 'first_name', 'last_name', 'phone_number')
        }),
        ('Organisation et rôle', {
            'fields': ('organization', 'role')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser')
        }),
        ('Informations de connexion', {
            'fields': ('last_login', 'last_login_ip', 'date_joined')
        }),
    )
    
    readonly_fields = ['last_login', 'date_joined']
