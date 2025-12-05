"""
Utilitaires pour l'envoi d'emails dans l'application accounts.
"""
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from datetime import datetime


def send_welcome_email(user, temp_password):
    """
    Envoie un email de bienvenue au nouvel utilisateur avec son mot de passe temporaire.
    
    Args:
        user: Instance du modèle User
        temp_password: Mot de passe temporaire généré
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    try:
        # Contexte pour le template
        context = {
            'user': user,
            'temp_password': temp_password,
            'login_url': settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:5173/login',
            'current_year': datetime.now().year,
        }
        
        # Rendu du template HTML
        html_message = render_to_string('emails/welcome_user.html', context)
        
        # Version texte simple (fallback)
        text_message = f"""
Bonjour {user.first_name} {user.last_name},

Votre compte a été créé avec succès sur PensionPay.

Vos identifiants de connexion :
- Email : {user.email}
- Mot de passe temporaire : {temp_password}
- Rôle : {user.get_role_display()}

⚠️ IMPORTANT : Ce mot de passe est temporaire. Vous devez le changer lors de votre première connexion.

Organisation : {user.organization.name if user.organization else 'Non définie'}

Cordialement,
L'équipe PensionPay
        """
        
        # Envoi de l'email
        send_mail(
            subject='Bienvenue sur PensionPay - Vos identifiants',
            message=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        return True
        
    except Exception as e:
        # Logger l'erreur en production
        print(f"Erreur lors de l'envoi de l'email à {user.email}: {str(e)}")
        return False


def send_password_reset_email(user, reset_token):
    """
    Envoie un email pour réinitialiser le mot de passe.
    
    Args:
        user: Instance du modèle User
        reset_token: Token de réinitialisation
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    # TODO: Implémenter quand la fonctionnalité de reset sera nécessaire
    pass
