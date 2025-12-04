from django.db import models
import uuid


class Account(models.Model):
    """
    Représente un compte DFSP avec mapping vers une partie Mojaloop.
    Gère le solde et les réservations pour les transferts en cours.
    """
    party_id_type = models.CharField(max_length=32)
    party_identifier = models.CharField(max_length=128)
    account_id = models.CharField(max_length=64, unique=True)
    balance = models.BigIntegerField(default=0)  # en unités mineures (centimes)
    reserved = models.BigIntegerField(default=0)  # montant réservé pour transferts en cours
    organization = models.ForeignKey(
        'accounts.Organization',
        on_delete=models.CASCADE,
        related_name='accounts',
        help_text="Organisation propriétaire du compte"
    )

    def available(self):
        """Retourne le solde disponible après déduction des réservations."""
        return self.balance - self.reserved

    def __str__(self):
        return f"{self.account_id} ({self.party_id_type}:{self.party_identifier})"


class BulkTransfer(models.Model):
    """
    Représente un transfert groupé contenant plusieurs transferts individuels.
    États possibles: PENDING, PROCESSING, COMPLETED, FAILED, PARTIALLY_COMPLETED
    """
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    bulk_id = models.CharField(max_length=128, unique=True)
    payer_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='bulk_payer')
    total_amount = models.BigIntegerField(default=0)
    currency = models.CharField(max_length=8, default='XOF')
    state = models.CharField(max_length=32, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.bulk_id} - {self.state}"


class IndividualTransfer(models.Model):
    """
    Représente un transfert individuel au sein d'un bulk transfer.
    États possibles: PENDING, COMPLETED, FAILED
    """
    transfer_id = models.CharField(max_length=128, unique=True)
    bulk = models.ForeignKey(BulkTransfer, on_delete=models.CASCADE, related_name='individuals', null=True, blank=True)
    payee_party_id_type = models.CharField(max_length=32)
    payee_party_identifier = models.CharField(max_length=128)
    payee_account = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True)
    amount = models.BigIntegerField()  # en unités mineures
    currency = models.CharField(max_length=8, default='XOF')
    status = models.CharField(max_length=32, default='PENDING')
    ilp_packet = models.TextField(blank=True, null=True)
    condition = models.CharField(max_length=256, blank=True, null=True)
    fulfilment = models.CharField(max_length=256, blank=True, null=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.transfer_id} - {self.status}"
