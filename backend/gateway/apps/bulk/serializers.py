from rest_framework import serializers


class PartyIdInfoSerializer(serializers.Serializer):
    partyIdType = serializers.CharField(required=False)
    partyIdentifier = serializers.CharField(required=False)


class AmountSerializer(serializers.Serializer):
    amount = serializers.CharField()
    currency = serializers.CharField()


class IndividualQuoteRequestSerializer(serializers.Serializer):
    quoteId = serializers.CharField(required=False)
    transactionId = serializers.CharField(required=False)
    payee = serializers.DictField(child=serializers.DictField(), required=False)
    amountType = serializers.CharField(required=False)
    amount = serializers.DictField(child=serializers.CharField(), required=False)


class IndividualQuoteResultSerializer(serializers.Serializer):
    quoteId = serializers.CharField()
    payeeReceiveAmount = serializers.DictField()
    payeeFspFee = serializers.DictField()
    payeeFspCommission = serializers.DictField()
    ilpPacket = serializers.CharField()
    condition = serializers.CharField()


class BulkQuoteRequestSerializer(serializers.Serializer):
    bulkQuoteId = serializers.CharField(required=False)
    individualQuoteRequests = IndividualQuoteRequestSerializer(many=True)


class BulkQuoteResponseSerializer(serializers.Serializer):
    individualQuoteResults = IndividualQuoteResultSerializer(many=True)


class IndividualTransferResultSerializer(serializers.Serializer):
    transferId = serializers.CharField()
    fulfilment = serializers.CharField()


class TransferResponseSerializer(serializers.Serializer):
    individualTransferResults = IndividualTransferResultSerializer(many=True)


class IndividualTransferRequestSerializer(serializers.Serializer):
    transferId = serializers.CharField()
    transferAmount = serializers.DictField(child=serializers.CharField(), required=False)
    amount = serializers.CharField(required=False)
    currency = serializers.CharField(required=False)
    payee = serializers.DictField(child=serializers.DictField(), required=False)
    ilpPacket = serializers.CharField(required=False)
    condition = serializers.CharField(required=False)



class BulkTransferCreateResponseSerializer(serializers.Serializer):
    bulkTransferId = serializers.CharField()
    state = serializers.CharField()


class BulkCallbackRequestSerializer(serializers.Serializer):
    completedTimestamp = serializers.CharField(required=False)
    bulkTransferState = serializers.CharField(required=False)
    individualTransferResults = IndividualTransferResultSerializer(many=True)


class PartyResponseSerializer(serializers.Serializer):
    partyIdInfo = serializers.DictField()
    accounts = serializers.ListField(child=serializers.DictField())


class BulkTransferRequestFileSerializer(serializers.Serializer):
    payer_account = serializers.CharField(required=False)
    file = serializers.FileField()
