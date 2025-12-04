from django.urls import path
from . import views
from . import sse_views

urlpatterns = [
    # Endpoints principaux pour les bulk transfers
    path('bulk-transfers', views.create_bulk_transfers, name='create_bulk_transfers'),
    path('bulk-transfers/<str:bulk_id>/status', views.bulk_status, name='bulk_status'),
    
    # Endpoints de monitoring temps réel
    path('bulk-transfers/<str:bulk_id>/stream', sse_views.stream_bulk_status, name='stream_bulk_status'),
    path('bulk-transfers/<str:bulk_id>/wait', sse_views.wait_for_completion, name='wait_for_completion'),
    
    # Callback du SDK adapter (REQUIS - appelé quand les transferts se terminent)
    path('transfers/<str:transfer_id>', views.transfer_callback, name='transfer_callback'),
]
