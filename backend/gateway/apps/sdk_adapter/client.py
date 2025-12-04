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
