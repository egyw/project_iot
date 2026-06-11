import { getToken, removeToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = { ...options.headers };

  // Only set Content-Type to JSON if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized — token expired or invalid
  if (response.status === 401) {
    removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData.message || errorData.error || message;
    } catch {
      // Response body is not JSON, use default message
    }
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  get(endpoint) {
    return apiRequest(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    const options = { method: 'POST' };
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
    return apiRequest(endpoint, options);
  },

  put(endpoint, body) {
    const options = { method: 'PUT' };
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
    return apiRequest(endpoint, options);
  },

  delete(endpoint) {
    return apiRequest(endpoint, { method: 'DELETE' });
  },
};
