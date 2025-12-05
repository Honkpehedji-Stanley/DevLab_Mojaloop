import csv
import io
import uuid
import base64
import json
from datetime import datetime
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import Account, BulkTransfer, IndividualTransfer
import requests
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from . import serializers as sers
from apps.accounts.permissions import IsGestionnaire, IsSameOrganization

SCHEME_ADAPTER_URL = getattr(settings, 'SCHEME_ADAPTER_URL', 'http://mojaloop-connector-load-test:4001')


def parse_csv_file(file_bytes):
    """
    Parse un fichier CSV et retourne une liste de dictionnaires.
    Attend les colonnes: transferId, amount, currency, partyIdType, partyIdentifier
    """
    f = io.StringIO(file_bytes.decode('utf-8'))
    reader = csv.DictReader(f)
    return list(reader)


@csrf_exempt
@swagger_auto_schema(
    method='post',
    operation_description="""
    Create a bulk transfer by uploading a CSV file containing individual transfers.
    
    **CSV Format Options:**
    1. Standard format: `transferId,amount,currency,partyIdType,partyIdentifier`
    2. Payment list format: `type_id,valeur_id,devise,montant` (transferId auto-generated)
    
    **Process:**
    - Validates payer account and sufficient funds
    - Reserves funds for the bulk transfer
    - Creates individual transfer records
    - Triggers async Celery orchestration via SDK scheme-adapter
    - Returns immediately with bulk ID and PENDING state
    
    **Example:**
    ```
    transferId,amount,currency,partyIdType,partyIdentifier
    transfer-001,10000,XOF,PERSONAL_ID,0612345678
    transfer-002,5000,XOF,PERSONAL_ID,0698765432
    ```
    """,
    request_body=sers.BulkTransferRequestFileSerializer,
    responses={
        200: sers.BulkTransferCreateResponseSerializer,
        400: 'Bad Request - Missing file, invalid CSV, insufficient funds, or duplicate transfer IDs'
    },
    manual_parameters=[
        openapi.Parameter(
            'payer_account',
            openapi.IN_FORM,
            description="Payer account ID (required)",
            type=openapi.TYPE_STRING,
            required=True
        ),
        openapi.Parameter(
            'file',
            openapi.IN_FORM,
            description="CSV file containing transfers",
            type=openapi.TYPE_FILE,
            required=True
        )
    ]
)
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated, IsGestionnaire])
def create_bulk_transfers(request):
    if request.method != 'POST':
        return HttpResponse(status=405)

    # Récupérer le compte de l'organisation de l'utilisateur
    payer_account_id = request.POST.get('payer_account')
    
    # Si pas de payer_account fourni, utiliser le premier compte de l'organisation
    if not payer_account_id:
        payer_account = Account.objects.filter(
            organization=request.user.organization
        ).first()
        if not payer_account:
            return HttpResponseBadRequest(
                json.dumps({'error': 'Aucun compte actif trouvé pour votre organisation'}),
                content_type='application/json'
            )
    else:
        payer_account = Account.objects.filter(account_id=payer_account_id).first()
        if not payer_account:
            return HttpResponseBadRequest(
                json.dumps({'error': 'payer account not found'}),
                content_type='application/json'
            )
        
        # Vérifier que le compte appartient à l'organisation de l'utilisateur
        if payer_account.organization != request.user.organization:
            return HttpResponse(
                json.dumps({'error': 'Accès interdit à ce compte'}),
                status=403,
                content_type='application/json'
            )

    file = request.FILES.get('file')
    if not file:
        return HttpResponseBadRequest(json.dumps({'error': 'file is required'}), content_type='application/json')

    rows = parse_csv_file(file.read())

    # If the uploaded CSV is in `payment_list` format (type_id,valeur_id,devise,montant,...)
    # normalize it to the internal expected columns: transferId,amount,currency,partyIdType,partyIdentifier
    if rows:
        first_keys = {k.lower() for k in rows[0].keys()}
        if 'type_id' in first_keys or 'valeur_id' in first_keys:
            normalized = []
            for r in rows:
                # map fields, generate transferId since payment_list doesn't include it
                try:
                    amt = int(r.get('montant'))
                except Exception:
                    return HttpResponseBadRequest(json.dumps({'error': f"invalid montant for row {r}"}), content_type='application/json')
                normalized.append({
                    'transferId': str(uuid.uuid4()),
                    'amount': amt,
                    'currency': r.get('devise', 'XOF'),
                    'partyIdType': r.get('type_id'),
                    'partyIdentifier': r.get('valeur_id'),
                })
            rows = normalized

    # validate rows and detect duplicate transferIds in the uploaded CSV
    individual_objs = []
    total = 0
    currency = None
    seen_ids = set()
    for r in rows:
        try:
            amount = int(r.get('amount'))
        except Exception:
            return HttpResponseBadRequest(json.dumps({'error': f"invalid amount for row {r}"}), content_type='application/json')
        if currency is None:
            currency = r.get('currency', 'XOF')

        transfer_id = r.get('transferId') or str(uuid.uuid4())
        if transfer_id in seen_ids:
            return HttpResponseBadRequest(json.dumps({'error': f"duplicate transferId in csv: {transfer_id}"}), content_type='application/json')
        seen_ids.add(transfer_id)

        total += amount
        individual_objs.append({
            'transferId': transfer_id,
            'amount': amount,
            'currency': r.get('currency', 'XOF'),
            'partyIdType': r.get('partyIdType'),
            'partyIdentifier': r.get('partyIdentifier'),
        })

    if payer_account.available() < total:
        return HttpResponseBadRequest(json.dumps({'error': 'insufficient funds'}), content_type='application/json')

    bulk_id = f"bulk-{uuid.uuid4().hex[:12]}"

    with transaction.atomic():
        # Reserve funds
        payer_account.reserved += total
        payer_account.save()

        # ensure none of the provided transferIds already exist in DB (avoid UNIQUE constraint failures)
        existing_ids = list(IndividualTransfer.objects.filter(transfer_id__in=list(seen_ids)).values_list('transfer_id', flat=True))
        if existing_ids:
            return HttpResponseBadRequest(json.dumps({'error': f"transferId(s) already exist: {existing_ids}"}), content_type='application/json')

        bulk = BulkTransfer.objects.create(bulk_id=bulk_id, payer_account=payer_account, total_amount=total, currency=currency)
        for it in individual_objs:
            IndividualTransfer.objects.create(
                transfer_id=it['transferId'],
                bulk=bulk,
                payee_party_id_type=it['partyIdType'],
                payee_party_identifier=it['partyIdentifier'],
                amount=it['amount'],
                currency=it['currency'],
            )

    # Enqueue orchestration task (Celery) to perform discovery/quotes/execution asynchronously
    try:
        from .tasks import orchestrate_bulk
        orchestrate_bulk.delay(bulk.bulk_id)
    except Exception:
        # fallback: best-effort immediate forward (if Celery is not available)
        try:
            payload = {
                'bulkTransferId': bulk.bulk_id,
                'bulkQuoteId': f"quote-{uuid.uuid4().hex[:8]}",
                'payerFsp': payer_account.account_id,
                'individualTransfers': [
                    {
                        'transferId': it.transfer_id,
                        'transferAmount': {'amount': str(it.amount), 'currency': it.currency},
                        'payee': {'partyIdInfo': {'partyIdType': it.payee_party_id_type, 'partyIdentifier': it.payee_party_identifier}}
                    } for it in bulk.individuals.all()
                ]
            }
            requests.post(f"{SCHEME_ADAPTER_URL}/bulkTransfers", json=payload, timeout=5)
            bulk.state = 'IN_PROGRESS'
            bulk.save()
        except Exception:
            pass

    return JsonResponse({'bulkTransferId': bulk.bulk_id, 'state': bulk.state})


@csrf_exempt
@swagger_auto_schema(methods=['put', 'post'], request_body=sers.BulkCallbackRequestSerializer, responses={200: sers.BulkTransferCreateResponseSerializer})
@api_view(['PUT', 'POST'])
def bulk_callback(request, bulk_id):
    if request.method not in ('PUT', 'POST'):
        return HttpResponse(status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest(json.dumps({'error': 'invalid json'}), content_type='application/json')

    # idempotent: if already completed, return current state
    bulk = BulkTransfer.objects.filter(bulk_id=bulk_id).first()
    if not bulk:
        return HttpResponseBadRequest(json.dumps({'error': 'bulk not found'}), content_type='application/json')

    if bulk.state == 'COMPLETED':
        return JsonResponse({'bulkTransferId': bulk.bulk_id, 'state': bulk.state})

    # finalize debiting payer and credit payees based on provided individualTransferResults
    results = data.get('individualTransferResults', [])

    with transaction.atomic():
        total_debit = 0
        for r in results:
            tid = r.get('transferId')
            fulfilment = r.get('fulfilment')
            it = IndividualTransfer.objects.filter(transfer_id=tid, bulk=bulk).first()
            if not it:
                continue
            if it.status == 'COMPLETED':
                continue
            # credit payee account if present
            payee = Account.objects.filter(party_id_type=it.payee_party_id_type, party_identifier=it.payee_party_identifier).first()
            if payee:
                payee.balance += it.amount
                payee.save()
                it.payee_account = payee
            it.status = 'COMPLETED'
            it.fulfilment = fulfilment
            it.completed_at = datetime.utcnow()
            it.save()
            total_debit += it.amount

        # debit payer: reduce reserved and balance
        payer = bulk.payer_account
        payer.reserved = max(0, payer.reserved - total_debit)
        payer.balance = max(0, payer.balance - total_debit)
        payer.save()

        bulk.state = data.get('bulkTransferState', 'COMPLETED')
        bulk.save()

    return JsonResponse({'bulkTransferId': bulk.bulk_id, 'state': bulk.state})


@swagger_auto_schema(method='get', responses={200: sers.PartyResponseSerializer})
@api_view(['GET'])
def get_party(request, party_type, party_id):
    # Return party info if account exists
    acc = Account.objects.filter(party_id_type=party_type, party_identifier=party_id).first()
    if not acc:
        return HttpResponse(status=404)
    data = {
        'partyIdInfo': {
            'partyIdType': acc.party_id_type,
            'partyIdentifier': acc.party_identifier,
        },
        'accounts': [{'accountId': acc.account_id}]
    }
    return JsonResponse(data)


@swagger_auto_schema(method='post', request_body=sers.BulkQuoteRequestSerializer, responses={200: sers.BulkQuoteResponseSerializer})
@api_view(['POST'])
def post_quotes(request):
    # Expect JSON with bulkQuoteId and individualQuoteRequests
    if request.method != 'POST':
        return HttpResponse(status=405)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest(json.dumps({'error': 'invalid json'}), content_type='application/json')

    reqs = data.get('individualQuoteRequests', [])
    results = []
    for r in reqs:
        quoteId = r.get('quoteId') or f"quote-{uuid.uuid4().hex[:8]}"
        payee = r.get('payee', {}).get('partyIdInfo', {})
        partyType = payee.get('partyIdType')
        partyIdentifier = payee.get('partyIdentifier')
        amount = int(r.get('amount', {}).get('amount', 0)) if isinstance(r.get('amount', {}), dict) else int(r.get('amount') or 0)
        # fee: simple fixed fee 50 minor units or 1% whichever greater
        fee = max(50, int(amount * 0.01))
        # generate ilp packet placeholder and condition
        ilp = base64.b64encode(f"ilp:{quoteId}".encode()).decode()
        condition = base64.b64encode(f"cond:{quoteId}".encode()).decode()
        results.append({
            'quoteId': quoteId,
            'payeeReceiveAmount': {'amount': str(amount), 'currency': r.get('amount', {}).get('currency', 'XOF')},
            'payeeFspFee': {'amount': str(fee), 'currency': r.get('amount', {}).get('currency', 'XOF')},
            'payeeFspCommission': {'amount': '0', 'currency': r.get('amount', {}).get('currency', 'XOF')},
            'ilpPacket': ilp,
            'condition': condition,
        })

    return JsonResponse({'individualQuoteResults': results})


@swagger_auto_schema(method='post', request_body=None, responses={200: sers.TransferResponseSerializer})
@api_view(['POST'])
def post_transfers(request):
    # Expect JSON with bulkTransferId and individualTransfers similar to schema adapter simplified format
    if request.method != 'POST':
        return HttpResponse(status=405)
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest(json.dumps({'error': 'invalid json'}), content_type='application/json')

    indiv = data.get('individualTransfers', [])
    results = []
    with transaction.atomic():
        for t in indiv:
            transferId = t.get('transferId')
            amount = int(t.get('transferAmount', {}).get('amount') or t.get('amount') or 0)
            currency = t.get('transferAmount', {}).get('currency', 'XOF')
            payee_info = t.get('payee', {}).get('partyIdInfo', {}) if t.get('payee') else t.get('payee')
            partyType = payee_info.get('partyIdType')
            partyIdentifier = payee_info.get('partyIdentifier')

            # idempotent: if transfer already exists and completed, return existing fulfilment
            it = IndividualTransfer.objects.filter(transfer_id=transferId).first()
            if it and it.status == 'COMPLETED':
                results.append({'transferId': transferId, 'fulfilment': it.fulfilment})
                continue

            # find or create account for payee
            payee = Account.objects.filter(party_id_type=partyType, party_identifier=partyIdentifier).first()
            if not payee:
                # create a new account record (unfunded)
                payee = Account.objects.create(party_id_type=partyType, party_identifier=partyIdentifier, account_id=f"ACC-{uuid.uuid4().hex[:8]}", balance=0)

            # credit account
            payee.balance += amount
            payee.save()

            fulfilment = base64.b64encode(f"fulfil:{transferId}".encode()).decode()

            if it:
                it.status = 'COMPLETED'
                it.payee_account = payee
                it.fulfilment = fulfilment
                it.completed_at = datetime.utcnow()
                it.save()
            else:
                # create a standalone individual transfer record (not necessarily linked to a bulk here)
                IndividualTransfer.objects.create(
                    transfer_id=transferId,
                    bulk=None,
                    payee_party_id_type=partyType or 'MSISDN',
                    payee_party_identifier=partyIdentifier,
                    payee_account=payee,
                    amount=amount,
                    currency=currency,
                    status='COMPLETED',
                    fulfilment=fulfilment,
                    completed_at=datetime.utcnow(),
                )

            results.append({'transferId': transferId, 'fulfilment': fulfilment})

    return JsonResponse({'individualTransferResults': results})


@csrf_exempt
@swagger_auto_schema(
    methods=['put'],
    operation_description="""
    Callback endpoint for SDK scheme adapter to notify individual transfer completion.
    
    **Called by:** Mojaloop SDK scheme-adapter  
    **When:** After receiving transfer fulfillment from the hub
    
    **Process:**
    1. Validates transfer exists and is not already completed (idempotent)
    2. Credits payee account with transfer amount
    3. Debits payer reserved amount atomically
    4. Marks transfer as COMPLETED
    5. Auto-completes bulk if all transfers done
    
    **Note:** This is an internal callback endpoint used by the SDK adapter.
    In production, this should be protected and only accessible from trusted sources.
    """,
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        properties={
            'currentState': openapi.Schema(type=openapi.TYPE_STRING, description='Transfer state (COMPLETED, FAILED, etc.)'),
            'fulfilment': openapi.Schema(type=openapi.TYPE_STRING, description='ILP fulfilment proof'),
        }
    ),
    responses={
        200: openapi.Response(
            description='Transfer callback processed successfully',
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'transferId': openapi.Schema(type=openapi.TYPE_STRING),
                    'status': openapi.Schema(type=openapi.TYPE_STRING)
                }
            )
        ),
        400: 'Invalid request or transfer not found',
        405: 'Method not allowed'
    }
)
@api_view(['PUT'])
def transfer_callback(request, transfer_id):
    """
    Callback endpoint for SDK scheme adapter to notify transfer completion.
    The adapter calls this when it receives a transfer fulfillment from the hub.
    """
    if request.method != 'PUT':
        return HttpResponse(status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        return HttpResponseBadRequest(json.dumps({'error': 'invalid json'}), content_type='application/json')

    # Find the individual transfer
    it = IndividualTransfer.objects.filter(transfer_id=transfer_id).first()
    if not it:
        return HttpResponseBadRequest(json.dumps({'error': 'transfer not found'}), content_type='application/json')

    # Idempotent - if already completed, return success
    if it.status == 'COMPLETED':
        return JsonResponse({'transferId': transfer_id, 'status': 'COMPLETED'})

    # Extract transfer state from callback
    transfer_state = data.get('currentState') or data.get('transferState') or 'COMPLETED'
    
    if transfer_state == 'COMMITTED' or transfer_state == 'COMPLETED':
        with transaction.atomic():
            # Credit payee account
            payee = Account.objects.filter(
                party_id_type=it.payee_party_id_type,
                party_identifier=it.payee_party_identifier
            ).first()
            
            if not payee:
                # Create payee account if it doesn't exist
                payee = Account.objects.create(
                    party_id_type=it.payee_party_id_type,
                    party_identifier=it.payee_party_identifier,
                    account_id=f"ACC-{uuid.uuid4().hex[:8]}",
                    balance=0
                )
            
            payee.balance += it.amount
            payee.save()
            it.payee_account = payee
            
            # Debit payer account (reduce reserved and balance)
            if it.bulk and it.bulk.payer_account:
                payer = it.bulk.payer_account
                payer.reserved = max(0, payer.reserved - it.amount)
                payer.balance = max(0, payer.balance - it.amount)
                payer.save()
            
            # Mark transfer as completed
            it.status = 'COMPLETED'
            it.fulfilment = data.get('fulfilment') or base64.b64encode(f"fulfil:{transfer_id}".encode()).decode()
            it.completed_at = datetime.utcnow()
            it.save()
            
            # Check if all transfers in bulk are completed
            if it.bulk:
                all_completed = not it.bulk.individuals.filter(status='PENDING').exists()
                if all_completed:
                    it.bulk.state = 'COMPLETED'
                    it.bulk.save()

    return JsonResponse({'transferId': transfer_id, 'status': it.status})


@swagger_auto_schema(
    method='get',
    operation_description="""
    Get the status of a bulk transfer and all its individual transfers.
    
    **Response includes:**
    - Bulk transfer state (PENDING, IN_PROGRESS, COMPLETED, FAILED)
    - Total amount and currency
    - Payer account ID
    - Array of individual transfers with their status
    
    **Individual transfer states:**
    - PENDING: Not yet processed
    - COMPLETED: Successfully transferred
    - FAILED: Transfer failed
    
    **Example response:**
    ```json
    {
      "bulkTransferId": "bulk-abc123",
      "state": "COMPLETED",
      "total_amount": 15500,
      "currency": "XOF",
      "payer_account": "PAYER-001",
      "individualTransfers": [
        {
          "transferId": "transfer-001",
          "amount": 10000,
          "currency": "XOF",
          "status": "COMPLETED",
          "fulfilment": "...",
          "completed_at": "2025-12-04T14:30:00Z"
        }
      ]
    }
    ```
    """,
    responses={
        200: sers.BulkTransferCreateResponseSerializer,
        403: 'Accès interdit',
        404: 'Bulk transfer not found'
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bulk_status(request, bulk_id):
    """Return the bulk status and the list of individual transfer states."""
    bulk = BulkTransfer.objects.filter(bulk_id=bulk_id).first()
    if not bulk:
        return HttpResponse(status=404)
    
    # Vérifier que le bulk appartient à l'organisation de l'utilisateur
    if bulk.payer_account.organization != request.user.organization:
        return HttpResponse(
            json.dumps({'error': 'Accès interdit'}),
            status=403,
            content_type='application/json'
        )

    # Récupérer tous les transferts individuels
    all_individuals = bulk.individuals.all()
    total_count = all_individuals.count()
    completed_count = all_individuals.filter(status='COMPLETED').count()
    failed_count = all_individuals.filter(status='FAILED').count()
    
    # Calculer la progression
    progress_percent = (completed_count + failed_count) / total_count * 100 if total_count > 0 else 0

    individuals = []
    for it in all_individuals:
        # Récupérer les informations du bénéficiaire depuis le compte ou le CSV original
        payee_name = None
        if it.payee_account:
            payee_name = it.payee_account.account_holder_name
        
        individuals.append({
            'transferId': it.transfer_id,
            'amount': it.amount,
            'currency': it.currency,
            'status': it.status,
            'fulfilment': it.fulfilment,
            'completed_at': it.completed_at.isoformat() if it.completed_at else None,
            'payee_party_id_type': it.payee_party_id_type,
            'payee_party_identifier': it.payee_party_identifier,
            'payee_name': payee_name,
            'error_message': getattr(it, 'error_description', None) or getattr(it, 'error_code', None),
        })

    data = {
        'bulkTransferId': bulk.bulk_id,
        'state': bulk.state,
        'total_amount': bulk.total_amount,
        'currency': bulk.currency,
        'payer_account': bulk.payer_account.account_id if bulk.payer_account else None,
        'total': total_count,
        'completed': completed_count,
        'failed': failed_count,
        'pending': total_count - completed_count - failed_count,
        'progress_percent': round(progress_percent, 2),
        'individualTransfers': individuals,
    }
    return JsonResponse(data)


@swagger_auto_schema(
    method='get',
    operation_description="""
    Liste l'historique de tous les transferts en masse (bulk transfers).
    
    **Permissions:**
    - GESTIONNAIRE : Voit tous les transferts de son organisation
    - SUPERVISEUR : Voit tous les transferts de son organisation (lecture seule)
    
    **Filtres disponibles:**
    - `state`: Filtrer par état (PENDING, PROCESSING, COMPLETED, FAILED)
    - `start_date`: Date de début (format: YYYY-MM-DD)
    - `end_date`: Date de fin (format: YYYY-MM-DD)
    - `limit`: Nombre de résultats (défaut: 50, max: 200)
    - `offset`: Pagination offset (défaut: 0)
    
    **Exemple:**
    ```
    GET /api/bulk-transfers?state=COMPLETED&limit=20
    ```
    """,
    manual_parameters=[
        openapi.Parameter('state', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('start_date', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('end_date', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('limit', openapi.IN_QUERY, type=openapi.TYPE_INTEGER),
        openapi.Parameter('offset', openapi.IN_QUERY, type=openapi.TYPE_INTEGER),
    ],
    responses={
        200: openapi.Response(
            description='Liste des transferts en masse',
            schema=openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'total': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'results': openapi.Schema(type=openapi.TYPE_ARRAY, items=openapi.Schema(type=openapi.TYPE_OBJECT)),
                }
            )
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_bulk_transfers(request):
    """
    Liste tous les transferts en masse pour l'organisation de l'utilisateur.
    GESTIONNAIRE et SUPERVISEUR peuvent voir l'historique de leur organisation.
    """
    from datetime import datetime
    
    # Filtrer par organisation de l'utilisateur
    queryset = BulkTransfer.objects.filter(
        payer_account__organization=request.user.organization
    ).select_related('payer_account', 'payer_account__organization')
    
    # Filtres optionnels
    state = request.GET.get('state')
    if state:
        queryset = queryset.filter(state=state)
    
    start_date = request.GET.get('start_date')
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            queryset = queryset.filter(created_at__gte=start_dt)
        except ValueError:
            pass
    
    end_date = request.GET.get('end_date')
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            queryset = queryset.filter(created_at__lte=end_dt)
        except ValueError:
            pass
    
    # Pagination
    limit = int(request.GET.get('limit', 50))
    limit = min(limit, 200)  # Max 200
    offset = int(request.GET.get('offset', 0))
    
    total = queryset.count()
    results = queryset.order_by('-created_at')[offset:offset + limit]
    
    # Serialiser les résultats
    bulk_list = []
    for bulk in results:
        # Compter les transferts par état
        transfers_count = bulk.individuals.count()
        completed_count = bulk.individuals.filter(status='COMPLETED').count()
        failed_count = bulk.individuals.filter(status='FAILED').count()
        
        bulk_list.append({
            'id': bulk.id,
            'bulk_id': bulk.bulk_id,
            'state': bulk.state,
            'total_amount': bulk.total_amount,
            'currency': bulk.currency,
            'transfers_count': transfers_count,
            'completed_count': completed_count,
            'failed_count': failed_count,
            'payer_account': bulk.payer_account.account_id if bulk.payer_account else None,
            'organization': bulk.payer_account.organization.name if bulk.payer_account and bulk.payer_account.organization else None,
            'created_at': bulk.created_at.isoformat() if bulk.created_at else None,
        })
    
    return Response({
        'total': total,
        'count': len(bulk_list),
        'limit': limit,
        'offset': offset,
        'results': bulk_list
    })


@swagger_auto_schema(
    method='get',
    operation_description="""
    Récupère les détails complets d'un transfert en masse spécifique.
    
    Inclut tous les transferts individuels avec leur état, montant, et destinataire.
    
    **Permissions:**
    - Accessible uniquement aux utilisateurs de la même organisation
    """,
    responses={
        200: openapi.Response(description='Détails du transfert en masse'),
        404: 'Transfert non trouvé',
        403: 'Accès refusé (pas la même organisation)'
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bulk_transfer_details(request, bulk_id):
    """
    Récupère les détails complets d'un transfert en masse avec tous ses transferts individuels.
    """
    try:
        bulk = BulkTransfer.objects.select_related(
            'payer_account',
            'payer_account__organization'
        ).get(bulk_id=bulk_id)
    except BulkTransfer.DoesNotExist:
        return Response(
            {'error': f'Transfert en masse {bulk_id} introuvable'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Vérifier que l'utilisateur appartient à la même organisation
    if bulk.payer_account and bulk.payer_account.organization != request.user.organization:
        return Response(
            {'error': 'Accès refusé : ce transfert appartient à une autre organisation'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Récupérer tous les transferts individuels
    individual_transfers = bulk.individuals.all().order_by('id')
    
    transfers_data = []
    for transfer in individual_transfers:
        transfers_data.append({
            'id': transfer.id,
            'transfer_id': transfer.transfer_id,
            'amount': transfer.amount,
            'currency': transfer.currency,
            'payee_party_id_type': transfer.payee_party_id_type,
            'payee_party_identifier': transfer.payee_party_identifier,
            'status': transfer.status,
            'error_code': getattr(transfer, 'error_code', None),
            'error_description': getattr(transfer, 'error_description', None),
            'completed_at': transfer.completed_at.isoformat() if transfer.completed_at else None,
        })
    
    # Statistiques
    total_transfers = individual_transfers.count()
    completed = individual_transfers.filter(status='COMPLETED').count()
    failed = individual_transfers.filter(status='FAILED').count()
    pending = individual_transfers.filter(status='PENDING').count()
    processing = individual_transfers.filter(status='PROCESSING').count()
    
    return Response({
        'bulk_id': bulk.bulk_id,
        'state': bulk.state,
        'total_amount': bulk.total_amount,
        'currency': bulk.currency,
        'payer_account': {
            'account_id': bulk.payer_account.account_id if bulk.payer_account else None,
            'party_id_type': bulk.payer_account.party_id_type if bulk.payer_account else None,
            'party_identifier': bulk.payer_account.party_identifier if bulk.payer_account else None,
        },
        'organization': {
            'name': bulk.payer_account.organization.name if bulk.payer_account and bulk.payer_account.organization else None,
            'code': bulk.payer_account.organization.code if bulk.payer_account and bulk.payer_account.organization else None,
        },
        'statistics': {
            'total': total_transfers,
            'completed': completed,
            'failed': failed,
            'pending': pending,
            'processing': processing,
            'success_rate': round((completed / total_transfers * 100) if total_transfers > 0 else 0, 2),
        },
        'created_at': bulk.created_at.isoformat() if bulk.created_at else None,
        'individual_transfers': transfers_data,
    })
