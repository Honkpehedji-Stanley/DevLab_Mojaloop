from django.contrib import admin
from .models import Account, BulkTransfer, IndividualTransfer

admin.site.register(Account)
admin.site.register(BulkTransfer)
admin.site.register(IndividualTransfer)
