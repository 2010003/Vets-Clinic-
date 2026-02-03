const BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
        throw new Error(error.message || 'API request failed');
    }

    return response.json();
};

export default secureFetch;