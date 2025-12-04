from django.urls import path
from . import views
from . import sse_views

urlpatterns = [
    # Main bulk transfer endpoints
    path('bulk-transfers', views.create_bulk_transfers, name='create_bulk_transfers'),
    path('bulk-transfers/<str:bulk_id>/status', views.bulk_status, name='bulk_status'),
    
    # Real-time monitoring endpoints
    path('bulk-transfers/<str:bulk_id>/stream', sse_views.stream_bulk_status, name='stream_bulk_status'),
    path('bulk-transfers/<str:bulk_id>/wait', sse_views.wait_for_completion, name='wait_for_completion'),
    
    # SDK adapter callback endpoint (REQUIRED - called by adapter when transfers complete)
    path('transfers/<str:transfer_id>', views.transfer_callback, name='transfer_callback'),
    
    # Optional endpoints below - only needed if you want to simulate payee DFSP manually
    # In production with real SDK adapter + hub, these are NOT needed
    # Uncomment if you need them for testing without the adapter
    
    # path('bulk-transfers/<str:bulk_id>', views.bulk_callback, name='bulk_callback'),
    # path('parties/<str:party_type>/<str:party_id>', views.get_party, name='get_party'),
    # path('quotes', views.post_quotes, name='post_quotes'),
    # path('transfers', views.post_transfers, name='post_transfers'),
]
