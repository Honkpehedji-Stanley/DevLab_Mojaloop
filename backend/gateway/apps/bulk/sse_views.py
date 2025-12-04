"""
Server-Sent Events (SSE) endpoint for real-time bulk transfer status updates.
"""
import json
import time
from django.http import StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from .models import BulkTransfer, IndividualTransfer
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from rest_framework.decorators import api_view


def event_stream(bulk_id):
    """
    Generator that yields SSE events for bulk transfer status.
    Polls the database and sends updates when state changes.
    Stops when bulk reaches a final state (COMPLETED, FAILED, PARTIALLY_COMPLETED).
    """
    last_state = None
    last_completed_count = 0
    
    while True:
        try:
            bulk = BulkTransfer.objects.get(bulk_id=bulk_id)
            transfers = IndividualTransfer.objects.filter(bulk=bulk)
            
            completed = transfers.filter(status='COMPLETED').count()
            failed = transfers.filter(status='FAILED').count()
            pending = transfers.filter(status='PENDING').count()
            total = transfers.count()
            
            # Determine bulk state
            if pending == 0:
                if failed == 0:
                    current_state = 'COMPLETED'
                elif completed == 0:
                    current_state = 'FAILED'
                else:
                    current_state = 'PARTIALLY_COMPLETED'
            else:
                current_state = 'PROCESSING'
            
            # Update bulk state if changed
            if bulk.state != current_state:
                bulk.state = current_state
                bulk.save(update_fields=['state'])
            
            # Send update if state or progress changed
            if current_state != last_state or completed != last_completed_count:
                data = {
                    'bulkTransferId': bulk_id,
                    'state': current_state,
                    'total': total,
                    'completed': completed,
                    'failed': failed,
                    'pending': pending,
                    'progress_percent': round((completed + failed) / total * 100, 2) if total > 0 else 0
                }
                
                yield f"data: {json.dumps(data)}\n\n"
                
                last_state = current_state
                last_completed_count = completed
                
                # Stop streaming if final state reached
                if current_state in ['COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED']:
                    # Send final event
                    yield f"event: done\ndata: {json.dumps({'message': 'Transfer completed', 'state': current_state})}\n\n"
                    break
            
            # Poll every 1 second
            time.sleep(1)
            
        except BulkTransfer.DoesNotExist:
            error_data = {'error': 'Bulk transfer not found', 'bulkTransferId': bulk_id}
            yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
            break
        except Exception as e:
            error_data = {'error': str(e), 'bulkTransferId': bulk_id}
            yield f"event: error\ndata: {json.dumps(error_data)}\n\n"
            break


@csrf_exempt
@swagger_auto_schema(
    method='get',
    operation_description="""
    Stream real-time updates for a bulk transfer using Server-Sent Events (SSE).
    
    **How it works:**
    - Opens a persistent HTTP connection
    - Sends updates every time the transfer state changes
    - Automatically closes when transfer reaches final state (COMPLETED, FAILED, PARTIALLY_COMPLETED)
    - Updates include: state, total, completed, failed, pending counts, and progress percentage
    
    **Frontend usage (JavaScript):**
    ```javascript
    const eventSource = new EventSource('http://localhost:8000/api/bulk-transfers/bulk-xxx/stream');
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Progress:', data.progress_percent + '%');
        console.log('State:', data.state);
        updateProgressBar(data.completed, data.total);
    };
    
    eventSource.addEventListener('done', (event) => {
        const data = JSON.parse(event.data);
        console.log('Transfer completed:', data.state);
        eventSource.close();
    });
    
    eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        console.error('Error:', data.error);
        eventSource.close();
    });
    ```
    
    **Events:**
    - `message`: Regular progress updates
    - `done`: Final state reached, connection will close
    - `error`: Error occurred, connection will close
    """,
    responses={
        200: 'text/event-stream - SSE stream',
        404: 'Bulk transfer not found'
    }
)
@api_view(['GET'])
def stream_bulk_status(request, bulk_id):
    """
    SSE endpoint for real-time bulk transfer status updates.
    """
    response = StreamingHttpResponse(
        event_stream(bulk_id),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
    return response


@csrf_exempt
@swagger_auto_schema(
    method='get',
    operation_description="""
    Wait for bulk transfer completion and return final result.
    
    **Blocking endpoint:**
    - Polls the database until transfer reaches final state
    - Maximum wait time: 5 minutes (configurable via timeout parameter)
    - Returns complete transfer details once done
    
    **Use case:**
    - When frontend prefers a simple blocking call instead of polling or SSE
    - For synchronous workflows that need to wait for completion
    
    **Query Parameters:**
    - `timeout`: Maximum wait time in seconds (default: 300, max: 600)
    """,
    manual_parameters=[
        openapi.Parameter(
            'timeout',
            openapi.IN_QUERY,
            description="Maximum wait time in seconds (default: 300, max: 600)",
            type=openapi.TYPE_INTEGER,
            required=False
        )
    ],
    responses={
        200: 'Transfer completed successfully',
        408: 'Request timeout - transfer still processing',
        404: 'Bulk transfer not found'
    }
)
@api_view(['GET'])
def wait_for_completion(request, bulk_id):
    """
    Blocking endpoint that waits for bulk transfer completion.
    Returns final result once all transfers are processed.
    """
    timeout = int(request.GET.get('timeout', 300))  # Default 5 minutes
    timeout = min(timeout, 600)  # Max 10 minutes
    
    start_time = time.time()
    poll_interval = 2  # Check every 2 seconds
    
    try:
        while True:
            bulk = BulkTransfer.objects.get(bulk_id=bulk_id)
            transfers = IndividualTransfer.objects.filter(bulk=bulk)
            
            completed = transfers.filter(status='COMPLETED').count()
            failed = transfers.filter(status='FAILED').count()
            pending = transfers.filter(status='PENDING').count()
            total = transfers.count()
            
            # Check if all transfers are done
            if pending == 0:
                # Determine final state
                if failed == 0:
                    final_state = 'COMPLETED'
                elif completed == 0:
                    final_state = 'FAILED'
                else:
                    final_state = 'PARTIALLY_COMPLETED'
                
                # Update bulk state
                bulk.state = final_state
                bulk.save(update_fields=['state'])
                
                # Return full details
                transfer_list = []
                for t in transfers:
                    transfer_list.append({
                        'transferId': t.transfer_id,
                        'amount': float(t.amount),
                        'currency': t.currency,
                        'status': t.state,
                        'fulfilment': t.fulfilment or '',
                        'error_code': t.error_code or None,
                        'error_description': t.error_description or None,
                        'completed_at': t.completed_at.isoformat() if t.completed_at else None
                    })
                
                return JsonResponse({
                    'bulkTransferId': bulk_id,
                    'state': final_state,
                    'total_amount': float(bulk.total_amount),
                    'currency': bulk.currency,
                    'payer_account': bulk.payer_account.account_id,
                    'total_transactions': total,
                    'completed_count': completed,
                    'failed_count': failed,
                    'pending_count': 0,
                    'created_at': bulk.created_at.isoformat(),
                    'completed_at': bulk.created_at.isoformat(),
                    'individualTransfers': transfer_list
                })
            
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed >= timeout:
                return JsonResponse({
                    'error': 'Request timeout',
                    'message': f'Transfer still processing after {timeout} seconds',
                    'bulkTransferId': bulk_id,
                    'current_progress': {
                        'completed': completed,
                        'failed': failed,
                        'pending': pending,
                        'total': total
                    }
                }, status=408)
            
            # Wait before next poll
            time.sleep(poll_interval)
            
    except BulkTransfer.DoesNotExist:
        return JsonResponse({
            'error': 'Bulk transfer not found',
            'bulkTransferId': bulk_id
        }, status=404)
