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

SCHEME_ADAPTER_URL = getattr(settings, 'SCHEME_ADAPTER_URL', 'http://scheme-adapter:4000')


def parse_csv_file(file_bytes):
    # Expecting CSV with headers: transferId,amount,currency,partyIdType,partyIdentifier
    f = io.StringIO(file_bytes.decode('utf-8'))
    reader = csv.DictReader(f)
    rows = []
    for r in reader:
        rows.append(r)
    return rows


@csrf_exempt
def create_bulk_transfers(request):
    if request.method != 'POST':
        return HttpResponse(status=405)

    # Expect multipart form with file field 'file' and optional 'payer_account'
    payer_account_id = request.POST.get('payer_account') or request.POST.get('from')
    file = request.FILES.get('file')
    if not file:
        return HttpResponseBadRequest(json.dumps({'error': 'file is required'}), content_type='application/json')

    rows = parse_csv_file(file.read())
    # validate rows
    individual_objs = []
    total = 0
    currency = None
    for r in rows:
        try:
            amount = int(r.get('amount'))
        except Exception:
            return HttpResponseBadRequest(json.dumps({'error': f"invalid amount for row {r}"}), content_type='application/json')
        if currency is None:
            currency = r.get('currency', 'XOF')
        total += amount
        individual_objs.append({
            'transferId': r.get('transferId') or str(uuid.uuid4()),
            'amount': amount,
            'currency': r.get('currency', 'XOF'),
            'partyIdType': r.get('partyIdType'),
            'partyIdentifier': r.get('partyIdentifier'),
        })

    if not payer_account_id:
        return HttpResponseBadRequest(json.dumps({'error': 'payer_account (form field) is required'}), content_type='application/json')

    payer_account = Account.objects.filter(account_id=payer_account_id).first()
    if not payer_account:
        return HttpResponseBadRequest(json.dumps({'error': 'payer account not found'}), content_type='application/json')

    if payer_account.available() < total:
        return HttpResponseBadRequest(json.dumps({'error': 'insufficient funds'}), content_type='application/json')

    bulk_id = f"bulk-{uuid.uuid4().hex[:12]}"

    with transaction.atomic():
        # Reserve funds
        payer_account.reserved += total
        payer_account.save()

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

    # Forward to scheme adapter (best-effort, asynchronous in production)
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
    except Exception:
        # ignore forwarding errors for now
        pass

    return JsonResponse({'bulkTransferId': bulk.bulk_id, 'state': bulk.state})


@csrf_exempt
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


@csrf_exempt
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


@csrf_exempt
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
