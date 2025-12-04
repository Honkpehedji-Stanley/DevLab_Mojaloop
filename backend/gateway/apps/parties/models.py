from django.db import models

class Party(models.Model):
    id_type = models.CharField(max_length=64)
    identifier = models.CharField(max_length=255)
    fsp_id = models.CharField(max_length=255, null=True)
    name = models.CharField(max_length=255, null=True)
    metadata = models.JSONField(null=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('id_type', 'identifier')
