import Papa from 'papaparse';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

const PENSION_API_URL = 'http://localhost:5000/api/pension';
const BACKEND_URL = 'http://localhost:8001/api';

// Default payer account - can be configured
const DEFAULT_PAYER_ACCOUNT = 'PAYER-001';

export const api = {
    validatePensions: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await axios.post(`${PENSION_API_URL}/validate`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Validation failed');
        }
    },

    confirmPensions: async (uploadId) => {
        try {
            const response = await axios.post(`${PENSION_API_URL}/confirm`, { uploadId });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Confirmation failed');
        }
    },

    cancelPensions: async (uploadId) => {
        try {
            await axios.post(`${PENSION_API_URL}/cancel`, { uploadId });
        } catch (error) {
            console.error('Cancellation failed', error);
        }
    },
    /**
     * Upload CSV file and create bulk transfer
     * @param {File} file - CSV file with format: type_id,valeur_id,devise,montant,nom_complet
     * @param {string} payerAccount - Optional payer account ID (defaults to PAYER-001)
     * @returns {Promise<{bulkTransferId: string, state: string}>}
     */
    uploadCSV: async (file, payerAccount = DEFAULT_PAYER_ACCOUNT) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('payer_account', payerAccount);

        try {
            const response = await axios.post(`${BACKEND_URL}/bulk-transfers`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Upload failed';
            throw new Error(message);
        }
    },

    /**
     * Get bulk transfer status
     * @param {string} bulkId - Bulk transfer ID
     * @returns {Promise<{bulkTransferId: string, state: string, total_amount: number, currency: string, payer_account: string, individualTransfers: Array}>}
     */
    getBulkStatus: async (bulkId) => {
        try {
            const response = await axios.get(`${BACKEND_URL}/bulk-transfers/${bulkId}/status`);
            return response.data;
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Failed to get status';
            throw new Error(message);
        }
    },

    /**
     * Poll bulk transfer status until completion or timeout
     * @param {string} bulkId - Bulk transfer ID
     * @param {function} onUpdate - Callback function called on each status update
     * @param {number} maxAttempts - Maximum number of polling attempts (default: 60)
     * @param {number} intervalMs - Polling interval in milliseconds (default: 2000)
     * @returns {Promise<Object>} Final bulk transfer status
     */
    pollBulkStatus: async (bulkId, onUpdate = null, maxAttempts = 60, intervalMs = 2000) => {
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const status = await api.getBulkStatus(bulkId);

                if (onUpdate) {
                    onUpdate(status);
                }

                // Check if completed or failed
                if (status.state === 'COMPLETED' || status.state === 'FAILED') {
                    return status;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, intervalMs));
                attempts++;
            } catch (error) {
                console.error('Polling error:', error);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        throw new Error('Polling timeout: Transfer is still in progress');
    },

    login: async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/login`, { email, password });
            if (response.data.accessToken) {
                localStorage.setItem('user', JSON.stringify(response.data));
            }
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Login failed');
        }
    },

    register: async (email, password, name) => {
        try {
            const response = await axios.post(`${API_URL}/register`, { email, password, name });
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.message || 'Registration failed');
        }
    },

    logout: () => {
        localStorage.removeItem('user');
    },

    getCurrentUser: () => {
        return JSON.parse(localStorage.getItem('user'));
    }
};


