from .base import *

DEBUG = True

# CORS plus permissif en développement
CORS_ALLOW_ALL_ORIGINS = True  # Accepter toutes les origines en dev
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]
