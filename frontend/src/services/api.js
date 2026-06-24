import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach access token to authorization headers
api.interceptors.request.use(
  (config) => {
    const tokensStr = localStorage.getItem('faceaura_tokens');
    if (tokensStr) {
      try {
        const tokens = JSON.parse(tokensStr);
        if (tokens?.access) {
          config.headers.Authorization = `Bearer ${tokens.access}`;
        }
      } catch (e) {
        console.error('Failed to parse tokens', e);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch 401 and try to refresh access token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 Unauthorized and not already retried
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url.includes('/api/token/')
    ) {
      originalRequest._retry = true;
      
      const tokensStr = localStorage.getItem('faceaura_tokens');
      if (tokensStr) {
        try {
          const tokens = JSON.parse(tokensStr);
          if (tokens?.refresh) {
            // Attempt to refresh the access token using a standard axios post to avoid recursive loop
            const refreshResponse = await axios.post(`${API_BASE_URL}/api/token/refresh/`, {
              refresh: tokens.refresh,
            });
            
            const newAccess = refreshResponse.data.access;
            tokens.access = newAccess;
            localStorage.setItem('faceaura_tokens', JSON.stringify(tokens));
            
            // Retry the original request with the new access token
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return axios(originalRequest);
          }
        } catch (refreshError) {
          console.error('Failed to refresh token, logging out...', refreshError);
          // Token expired or invalid, clear localStorage and redirect to login
          localStorage.removeItem('faceaura_tokens');
          window.dispatchEvent(new Event('auth_logout'));
          // Let the error propagate so pages can handle it or redirect
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
