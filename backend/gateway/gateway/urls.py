from django.urls import path, include

urlpatterns = [
    path('api/', include('apps.api.urls')),
    path('api/', include('apps.bulk.urls')),
]
