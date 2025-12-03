import Papa from 'papaparse';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

// Mock data generation for the response
const generateMockResponse = (inputData) => {
    return inputData.map((row, index) => {
        // Simulate some failures
        const isSuccess = Math.random() > 0.2;
        return {
            ...row,
            transactionId: `TXN-${Date.now()}-${index}`,
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            processedAt: new Date().toISOString(),
            message: isSuccess ? 'Payment processed successfully' : 'Insufficient funds or invalid account details'
        };
    });
};

export const api = {
    uploadPensions: async (file) => {
        return new Promise((resolve, reject) => {
            // Simulate network delay
            setTimeout(() => {
                Papa.parse(file, {
                    header: true,
                    complete: (results) => {
                        try {
                            if (results.data.length === 0) {
                                reject(new Error("File is empty"));
                                return;
                            }

                            const processedData = generateMockResponse(results.data);

                            // Convert back to CSV
                            const csv = Papa.unparse(processedData);
                            resolve({ data: processedData, csvRaw: csv });
                        } catch (err) {
                            reject(new Error("Failed to process file"));
                        }
                    },
                    error: (err) => {
                        reject(new Error("Failed to parse CSV"));
                    }
                });
            }, 2000); // 2 seconds delay
        });
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
