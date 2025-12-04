from django.urls import path
from . import views

urlpatterns = [
    path('bulk-transfers', views.create_bulk_transfers, name='create_bulk_transfers'),
    path('bulk-transfers/<str:bulk_id>', views.bulk_callback, name='bulk_callback'),
    path('bulk-transfers/<str:bulk_id>/status', views.bulk_status, name='bulk_status'),

    # Payee endpoints
    path('parties/<str:party_type>/<str:party_id>', views.get_party, name='get_party'),
    path('quotes', views.post_quotes, name='post_quotes'),
    path('transfers', views.post_transfers, name='post_transfers'),
]
