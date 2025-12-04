from celery import shared_task
import requests
import time
import base64
import uuid
from django.utils import timezone
from django.db import transaction
from .models import BulkTransfer, IndividualTransfer, Account
from django.conf import settings

SCHEME_ADAPTER_URL = getattr(settings, 'SCHEME_ADAPTER_URL', 'http://scheme-adapter:4000')


@shared_task(bind=True, default_retry_delay=5, max_retries=3)
def orchestrate_bulk(self, bulk_id):
    """Orchestrate the full lifecycle of a bulk transfer.

    Steps:
    1. For each individual transfer: discovery (GET /parties)
    2. Request bulkQuotes from scheme adapter (POST /bulkQuotes)
    3. Send execution (POST /bulkTransfers) to scheme adapter
    4. Wait / poll for callback or fetch results (in this simple implementation we POST and then record)
    This implementation is a simplified flow for local testing: it calls the scheme adapter endpoints
    but relies on the callback endpoint (`bulk_callback`) to be called by the adapter or test harness.
    """
    try:
        bulk = BulkTransfer.objects.select_related('payer_account').prefetch_related('individuals').get(bulk_id=bulk_id)
    except BulkTransfer.DoesNotExist:
        return {'error': 'bulk not found'}

    # quick helper to build individualTransfers payload
    individuals = []
    for it in bulk.individuals.all():
        individuals.append({
            'transferId': it.transfer_id,
            'transferAmount': {'amount': str(it.amount), 'currency': it.currency},
            'payee': {'partyIdInfo': {'partyIdType': it.payee_party_id_type, 'partyIdentifier': it.payee_party_identifier}}
        })

    # 1) Discovery - best-effort: call GET /parties for each payee to let scheme-adapter populate routing
    # Note: scheme-adapter will itself perform discovery; this is optional but demonstrates the step
    for it in individuals:
        party = it['payee']['partyIdInfo']
        try:
            requests.get(f"{SCHEME_ADAPTER_URL}/parties/{party['partyIdType']}/{party['partyIdentifier']}", timeout=5)
        except Exception:
            # ignore discovery errors here
            pass

    # 2) Request bulk quotes
    quote_payload = {
        'bulkQuoteId': f"quote-{uuid.uuid4().hex[:8]}",
        'individualQuoteRequests': [
            {
                'quoteId': f"q-{i+1}-{uuid.uuid4().hex[:6]}",
                'transactionId': f"tx-{i+1}-{uuid.uuid4().hex[:6]}",
                'payee': item['payee'],
                'amountType': 'RECEIVE',
                'amount': item['transferAmount']
            } for i, item in enumerate(individuals)
        ]
    }

    try:
        requests.post(f"{SCHEME_ADAPTER_URL}/bulkQuotes", json=quote_payload, timeout=10)
    except Exception:
        # we do not fail the whole task on quote post error here; adapter may be offline in local tests
        pass

    # 3) Execute bulkTransfers via scheme adapter
    exec_payload = {
        'bulkTransferId': bulk.bulk_id,
        'individualTransfers': individuals
    }

    try:
        requests.post(f"{SCHEME_ADAPTER_URL}/bulkTransfers", json=exec_payload, timeout=10)
    except Exception:
        # best-effort, the adapter may accept later
        pass

    # Note: in real deployment we listen for adapter callbacks. Here we simply mark that orchestration has
    # been attempted; the adapter (or test harness) should call our /bulk-transfers/<id> callback endpoint
    # to finalize debits/credits. We update the bulk state to IN_PROGRESS to indicate progress.
    bulk.state = 'IN_PROGRESS'
    bulk.save()

    return {'status': 'started', 'bulk_id': bulk.bulk_id}
