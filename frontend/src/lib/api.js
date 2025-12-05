import axios from 'axios';

const API_URL = 'http://localhost:8000/api/auth';
const BACKEND_URL = 'http://localhost:8000/api';

// Helper to get token
const getAccessToken = () => localStorage.getItem('accessToken');

// Axios interceptor to add token to requests
axios.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Axios interceptor to handle 401 and refresh token
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) throw new Error('No refresh token');

                const response = await axios.post(`${API_URL}/refresh`, { refresh: refreshToken });
                const { access } = response.data;

                localStorage.setItem('accessToken', access);
                axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;
                originalRequest.headers['Authorization'] = `Bearer ${access}`;

                return axios(originalRequest);
            } catch (refreshError) {
                // Logout if refresh fails
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export const api = {
    // Auth
    login: async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/login`, { email, password });
            const { access, refresh, user } = response.data;
            localStorage.setItem('accessToken', access);
            localStorage.setItem('refreshToken', refresh);
            localStorage.setItem('user', JSON.stringify(user));

            return { user, access, refresh };
        } catch (error) {
            throw new Error(error.response?.data?.detail || 'Login failed');
        }
    },

    logout: async () => {
        try {
            const refresh = localStorage.getItem('refreshToken');
            if (refresh) {
                await axios.post(`${API_URL}/logout`, { refresh });
            }
        } catch (error) {
            console.error('Logout error', error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        }
    },

    getCurrentUser: async () => {
        try {
            const response = await axios.get(`${API_URL}/me`);
            return response.data;
        } catch (error) {
            // Fallback to local storage if endpoint fails or not implemented yet
            return JSON.parse(localStorage.getItem('user'));
        }
    },

    // Bulk Transfers
    uploadCSV: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('callback_url', `${BACKEND_URL}/transfers`); // Default callback

        try {
            const response = await axios.post(`${BACKEND_URL}/bulk-transfers`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data; // { bulkTransferId: "...", state: "PENDING" }
        } catch (error) {
            const message = error.response?.data?.error || error.message || 'Upload failed';
            throw new Error(message);
        }
    },

    getBulkTransferStatus: async (bulkId) => {
        try {
            const response = await axios.get(`${BACKEND_URL}/bulk-transfers/${bulkId}/status`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to get status');
        }
    },

    // SSE Helper
    getBulkTransferStreamUrl: (bulkId) => {
        return `${BACKEND_URL}/bulk-transfers/${bulkId}/stream`;
    },

    // Admin - User Management
    adminCreateUser: async (userData) => {
        try {
            const response = await axios.post(`${API_URL}/admin/users`, userData);
            return response.data; // { user, temporary_password, email_sent, message }
        } catch (error) {
            const message = error.response?.data?.error ||
                error.response?.data?.email?.[0] ||
                error.response?.data?.detail ||
                error.message ||
                'Échec de la création de l\'utilisateur';
            throw new Error(message);
        }
    },

    // Get organizations list
    getOrganizations: async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/organizations`);
            return response.data;
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Échec de récupération des organisations');
        }
    },

    // Bulk Transfers History
    getBulkTransfersHistory: async (params = {}) => {
        try {
            const queryParams = new URLSearchParams();
            if (params.state) queryParams.append('state', params.state);
            if (params.start_date) queryParams.append('start_date', params.start_date);
            if (params.end_date) queryParams.append('end_date', params.end_date);
            if (params.limit) queryParams.append('limit', params.limit);
            if (params.offset) queryParams.append('offset', params.offset);

            const url = `${BACKEND_URL}/bulk-transfers/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await axios.get(url);
            return response.data; // { total, count, results: [...] }
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Échec de récupération de l\'historique');
        }
    },

    getBulkTransferDetails: async (bulkId) => {
        try {
            const response = await axios.get(`${BACKEND_URL}/bulk-transfers/${bulkId}/details`);
            return response.data; // { bulk_id, state, statistics, individual_transfers: [...] }
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Échec de récupération des détails');
        }
    }
};

export default api;
