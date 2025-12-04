const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// In-memory storage for validated data (for demonstration purposes)
// In a real app, use Redis or a database with a "pending" status
const pendingUploads = new Map();

router.post('/validate', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');

    Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            // Delete temp file
            fs.unlinkSync(req.file.path);

            if (results.errors.length > 0 && results.data.length === 0) {
                return res.status(400).send({ message: 'Failed to parse CSV', errors: results.errors });
            }

            const validRows = [];
            const invalidRows = [];

            results.data.forEach((row, index) => {
                // Validation logic for new schema: type_id,valeur_id,devise,montant,nom_complet
                const isValid =
                    row.type_id &&
                    row.valeur_id &&
                    row.devise && row.devise === "XOF" &&
                    row.montant && !isNaN(parseFloat(row.montant)) &&
                    row.nom_complet;

                if (isValid) {
                    validRows.push({ ...row, id: index });
                } else {
                    let reason = 'Invalid format';
                    if (!row.type_id) reason = 'Missing type_id';
                    else if (!row.valeur_id) reason = 'Missing valeur_id';
                    else if (!row.devise || row.devise !== "XOF") reason = 'Missing or invalid devise';
                    else if (!row.montant || isNaN(parseFloat(row.montant))) reason = 'Invalid or missing montant';
                    else if (!row.nom_complet) reason = 'Missing nom_complet';

                    invalidRows.push({ ...row, rowNumber: index + 2, reason });
                }
            });

            const uploadId = Date.now().toString();
            pendingUploads.set(uploadId, validRows);

            res.status(200).send({
                uploadId,
                totalRows: results.data.length,
                validCount: validRows.length,
                invalidCount: invalidRows.length,
                invalidRows: invalidRows
            });
        },
        error: (err) => {
            fs.unlinkSync(req.file.path);
            res.status(500).send({ message: 'Error parsing CSV' });
        }
    });
});

router.post('/confirm', (req, res) => {
    const { uploadId } = req.body;
    const data = pendingUploads.get(uploadId);

    if (!data) {
        return res.status(404).send({ message: 'Upload session expired or not found' });
    }

    // Process payments (mock logic)
    const processedData = data.map((row) => {
        const isSuccess = Math.random() > 0.2;
        return {
            ...row,
            transactionId: `TXN-${Date.now()}-${row.id}`,
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            processedAt: new Date().toISOString(),
            message: isSuccess ? 'Paiement effectué avec succès' : 'Insufficient funds or invalid account details'
        };
    });

    // Clear memory
    pendingUploads.delete(uploadId);

    res.status(200).send(processedData);
});

router.post('/cancel', (req, res) => {
    const { uploadId } = req.body;
    pendingUploads.delete(uploadId);
    res.status(200).send({ message: 'Upload cancelled' });
});

module.exports = router;
