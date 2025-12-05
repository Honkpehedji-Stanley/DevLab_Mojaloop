from django.urls import path
from apps.accounts import views as account_views

urlpatterns = [
    # Organizations
    path('organizations', account_views.list_organizations, name='list_organizations'),
]
