"""Client wrapper for calling the SDK container endpoints (squelette).

The real implementation should encapsulate all HTTP calls to the `sdk` service
and provide a clean API for the `transactions` services.
"""
import requests

SDK_BASE = 'http://sdk:4000'

def lookup_party(id_type, id_value):
    url = f"{SDK_BASE}/parties/{id_type}/{id_value}"
    # placeholder: real code should handle headers, auth, JWS, retries
    resp = requests.get(url)
    return resp.json()


def transfer(payload):
    """Send a transfer request to the SDK service.

    payload: dict with keys 'amount','currency','payee',...
    Returns parsed JSON response or raises on network errors.
    """
    url = f"{SDK_BASE}/transfers"
    try:
        resp = requests.post(url, json=payload, timeout=10)
        try:
            return resp.json()
        except Exception:
            return {'status_code': resp.status_code, 'text': resp.text}
    except Exception as e:
        raise
