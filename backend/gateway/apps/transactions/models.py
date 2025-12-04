"""Squelette models pour transactions."""
from django.db import models

class Quote(models.Model):
    quote_id = models.CharField(max_length=255, unique=True)
    request = models.JSONField(null=True)
    response = models.JSONField(null=True)
    status = models.CharField(max_length=32, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

class Transfer(models.Model):
    transfer_id = models.CharField(max_length=255, unique=True)
    quote = models.ForeignKey(Quote, null=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=32, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
