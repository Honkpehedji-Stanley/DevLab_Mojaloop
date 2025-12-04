from celery import shared_task
import requests
import time
import base64
import uuid
from django.utils import timezone
from django.db import transaction
from django.db.models import F
from .models import BulkTransfer, IndividualTransfer, Account
from django.conf import settings

SCHEME_ADAPTER_URL = getattr(settings, 'SCHEME_ADAPTER_URL', 'http://scheme-adapter:4000')


@shared_task(bind=True, default_retry_delay=5, max_retries=3)
def orchestrate_bulk(self, bulk_id):
    """Orchestrate the full lifecycle of a bulk transfer.

    For the SDK scheme adapter + mock hub setup, we use the outbound API
    to initiate individual transfers. The adapter will:
    1. Call GET /parties to the hub for each payee
    2. Call POST /quotes to the hub for each transfer
    3. Call POST /transfers to the hub for each transfer
    4. Receive callbacks from the hub
    5. Call our backend callback endpoint to finalize
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        bulk = BulkTransfer.objects.select_related('payer_account').prefetch_related('individuals').get(bulk_id=bulk_id)
    except BulkTransfer.DoesNotExist:
        return {'error': 'bulk not found'}

    # For each individual transfer, call the SDK adapter's outbound API
    # The SDK adapter expects a simplified transfer request and handles the Mojaloop flow
    success_count = 0
    error_count = 0
    
    for it in bulk.individuals.all():
        transfer_request = {
            'homeTransactionId': it.transfer_id,
            'from': {
                'idType': bulk.payer_account.party_id_type,
                'idValue': bulk.payer_account.party_identifier
            },
            'to': {
                'idType': it.payee_party_id_type,
                'idValue': it.payee_party_identifier
            },
            'amountType': 'SEND',
            'currency': it.currency,
            'amount': str(it.amount),
            'transactionType': 'TRANSFER'
        }
        
        try:
            response = requests.post(
                f"{SCHEME_ADAPTER_URL}/transfers",
                json=transfer_request,
                timeout=30
            )
            
            if response.status_code in (200, 201, 202):
                # SDK adapter returns the transfer state in the response
                result = response.json()
                transfer_state = result.get('currentState', '')
                
                if transfer_state == 'COMPLETED':
                    # Finalize the transfer: credit payee, debit payer
                    with transaction.atomic():
                        # Find or create payee account
                        payee, _ = Account.objects.get_or_create(
                            party_id_type=it.payee_party_id_type,
                            party_identifier=it.payee_party_identifier,
                            defaults={'balance': 0, 'account_id': f"{it.payee_party_id_type}-{it.payee_party_identifier}"}
                        )
                        
                        # Credit payee
                        payee.balance += it.amount
                        payee.save()
                        
                        # Debit payer reserved (atomic update)
                        Account.objects.filter(pk=bulk.payer_account.pk).update(
                            reserved=F('reserved') - it.amount
                        )
                        
                        # Mark transfer COMPLETED
                        it.status = 'COMPLETED'
                        it.fulfilment = result.get('fulfilment', '')
                        it.completed_at = timezone.now()
                        it.save()
                        
                    success_count += 1
                    logger.info(f"Transfer {it.transfer_id} COMPLETED")
                else:
                    # Transfer failed or still processing
                    error_count += 1
                    logger.warning(f"Transfer {it.transfer_id} in state {transfer_state}")
            else:
                error_count += 1
                logger.error(f"Transfer {it.transfer_id} failed with status {response.status_code}: {response.text}")
        except Exception as e:
            error_count += 1
            logger.error(f"Transfer {it.transfer_id} exception: {str(e)}")

    # Mark bulk as IN_PROGRESS - callbacks will update individual transfers
    bulk.state = 'IN_PROGRESS'
    bulk.save()
    
    # Check if all transfers are completed
    if success_count == bulk.individuals.count():
        bulk.state = 'COMPLETED'
        bulk.save()
        logger.info(f"Bulk {bulk.bulk_id} COMPLETED - {success_count}/{bulk.individuals.count()} transfers successful")
    elif error_count > 0:
        logger.warning(f"Bulk {bulk.bulk_id} partial completion - {success_count} succeeded, {error_count} failed")

    return {
        'status': 'completed' if bulk.state == 'COMPLETED' else 'partial',
        'bulk_id': bulk.bulk_id,
        'success_count': success_count,
        'error_count': error_count
    }
