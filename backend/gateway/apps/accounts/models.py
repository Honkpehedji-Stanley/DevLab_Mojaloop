from django.contrib.auth.models import AbstractUser
from django.db import models


class Organization(models.Model):
    """
    Organisme payeur de pensions (ex: CNSS Bénin).
    Regroupe les utilisateurs et les comptes de paiement.
    """
    name = models.CharField(max_length=255, help_text="Nom de l'organisme")
    code = models.CharField(max_length=50, unique=True, help_text="Code unique (ex: CNSS-BJ)")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Organisation"
        verbose_name_plural = "Organisations"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class User(AbstractUser):
    """
    Utilisateur de la plateforme de paiement de pensions.
    Deux rôles: GESTIONNAIRE (peut créer des transferts) et SUPERVISEUR (lecture seule).
    """
    ROLE_GESTIONNAIRE = 'GESTIONNAIRE'
    ROLE_SUPERVISEUR = 'SUPERVISEUR'
    
    ROLE_CHOICES = [
        (ROLE_GESTIONNAIRE, 'Gestionnaire'),
        (ROLE_SUPERVISEUR, 'Superviseur'),
    ]
    
    organization = models.ForeignKey(
        Organization, 
        on_delete=models.CASCADE,
        related_name='users',
        null=True,
        blank=True,
        help_text="Organisation à laquelle appartient l'utilisateur"
    )
    role = models.CharField(
        max_length=20, 
        choices=ROLE_CHOICES,
        default=ROLE_SUPERVISEUR,
        help_text="Rôle de l'utilisateur"
    )
    phone_number = models.CharField(
        max_length=20, 
        blank=True, 
        null=True,
        help_text="Numéro de téléphone (pour 2FA futur)"
    )
    last_login_ip = models.GenericIPAddressField(
        null=True, 
        blank=True,
        help_text="Dernière adresse IP de connexion"
    )

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ['username']

    def __str__(self):
        org_code = self.organization.code if self.organization else "N/A"
        return f"{self.username} ({self.get_role_display()}) - {org_code}"

    def can_create_transfers(self):
        """Vérifie si l'utilisateur peut créer des transferts."""
        return self.role == self.ROLE_GESTIONNAIRE and self.is_active

    def can_view_transfers(self):
        """Vérifie si l'utilisateur peut consulter les transferts."""
        return self.is_active
