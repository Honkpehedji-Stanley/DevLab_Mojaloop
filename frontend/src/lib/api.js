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
    login: async (username, password) => {
        try {
            const response = await axios.post(`${API_URL}/login`, { username, password });
            const { access, refresh } = response.data;
            localStorage.setItem('accessToken', access);
            localStorage.setItem('refreshToken', refresh);

            // Fetch user details after login if needed, or just store username
            // For now, we'll store a simple user object
            const user = { username };
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
    }
};
