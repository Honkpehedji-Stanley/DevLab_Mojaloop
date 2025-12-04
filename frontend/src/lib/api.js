import Papa from 'papaparse';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

// // Mock data generation for the response
// const generateMockResponse = (inputData) => {
//     return inputData.map((row, index) => {
//         // Simulate some failures
//         const isSuccess = Math.random() > 0.2;
//         return {
//             ...row,
//             transactionId: `TXN-${Date.now()}-${index}`,
//             status: isSuccess ? 'SUCCESS' : 'FAILED',
//             processedAt: new Date().toISOString(),
//             message: isSuccess ? 'Payment processed successfully' : 'Insufficient funds or invalid account details'
//         };
//     });
// };

const PENSION_API_URL = 'http://localhost:5000/api/pension';

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
