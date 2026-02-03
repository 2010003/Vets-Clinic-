const BASE_URL = 'http://localhost:5000/api'; // Point to Node backend

const secureFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');

    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
    };

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        // Handle 401 Unauthorized globally
        if (response.status === 401) {
            localStorage.removeItem('authToken');
            window.location.href = '/login';
        }
        throw new Error(error.message || 'API request failed');
    }

    return response.json();
};

export default secureFetch;