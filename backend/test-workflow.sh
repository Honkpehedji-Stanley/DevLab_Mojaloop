#!/bin/bash

echo "========================================="
echo "TEST WORKFLOW BULK TRANSFER"
echo "========================================="
echo ""

# 1. Créer le transfert
echo "1. Création du transfert en masse..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/bulk-transfers \
  -F "file=@gateway/transfers.csv" \
  -F "payer_account=PAYER-001")

BULK_ID=$(echo $RESPONSE | jq -r '.bulkTransferId')
STATE=$(echo $RESPONSE | jq -r '.state')

echo "   ✓ Bulk créé: $BULK_ID"
echo "   ✓ État initial: $STATE"
echo ""

# 2. Suivre en temps réel
echo "2. Suivi en temps réel (SSE)..."
echo "   (Appuyez sur Ctrl+C pour arrêter)"
echo ""

timeout 60 curl -N http://localhost:8000/api/bulk-transfers/$BULK_ID/stream 2>&1 || true

echo ""
echo ""

# 3. Vérifier le statut final
echo "3. Statut final:"
echo ""

FINAL_STATUS=$(curl -s http://localhost:8000/api/bulk-transfers/$BULK_ID/status)

echo $FINAL_STATUS | jq '{
  bulkTransferId,
  state,
  payer_account,
  total_amount,
  currency,
  total: (.individualTransfers | length),
  completed: [.individualTransfers[] | select(.status=="COMPLETED")] | length,
  failed: [.individualTransfers[] | select(.status=="FAILED")] | length,
  pending: [.individualTransfers[] | select(.status=="PENDING")] | length
}'

echo ""

# 4. Résumé
STATE=$(echo $FINAL_STATUS | jq -r '.state')
COMPLETED=$(echo $FINAL_STATUS | jq '[.individualTransfers[] | select(.status=="COMPLETED")] | length')
FAILED=$(echo $FINAL_STATUS | jq '[.individualTransfers[] | select(.status=="FAILED")] | length')
TOTAL=$(echo $FINAL_STATUS | jq '.individualTransfers | length')

echo "========================================="
echo "RÉSUMÉ"
echo "========================================="
echo "Bulk ID:        $BULK_ID"
echo "État final:     $STATE"
echo "Transferts:     $COMPLETED/$TOTAL réussis"
if [ "$FAILED" -gt 0 ]; then
  echo "Échecs:         $FAILED"
fi
echo "========================================="
