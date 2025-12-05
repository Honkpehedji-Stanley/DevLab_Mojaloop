from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentification JWT (utilise email au lieu de username)
    path('login', views.EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout', views.logout, name='logout'),
    
    # Profil utilisateur
    path('me', views.current_user, name='current_user'),
    
    # Administration (réservé aux admins)
    path('admin/users', views.admin_create_user, name='admin_create_user'),
]
