import axios from 'axios';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const rawUrl = process.env.NEXT_PUBLIC_API_URL || '';

    // On localhost with local backend (e.g. localhost:5588), connect directly for zero-delay throughput
    if (hostname === 'localhost' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
      return rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;
    }

    // If browser is NOT on localhost, but rawUrl points to localhost, use relative '/api'
    if (hostname !== 'localhost' && (rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))) {
      return '/api';
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl.endsWith('/api') ? rawUrl : `${rawUrl.replace(/\/$/, '')}/api`;
    }

    return '/api';
  }

  const rawUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  if (rawUrl.endsWith('/api') || rawUrl.endsWith('/api/')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return `${rawUrl.replace(/\/$/, '')}/api`;
  }
  return rawUrl;
};

const baseURL = getBaseURL();
if (typeof window !== 'undefined') {
  console.log('[API Base URL Diagnostics] baseURL resolved to:', baseURL);
}

const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — refresh token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (!original) {
      return Promise.reject(error);
    }

    const requestUrl = original.url || '';
    const isAuthEndpoint = (
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/verify-2fa') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password')
    );

    // Never attempt token refresh or reload on auth endpoints (e.g. invalid credentials during login)
    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const cleanBase = baseURL.replace(/\/$/, '');
        const refreshEndpoint = cleanBase.endsWith('/api')
          ? `${cleanBase}/auth/refresh`
          : `${cleanBase}/api/auth/refresh`;

        const { data } = await axios.post(refreshEndpoint, { refreshToken });
        if (data.success) {
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        }
      } catch (refreshErr) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // Only redirect to /login if we are not already on the login or auth page to avoid page reload loops
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          !window.location.pathname.startsWith('/login')
        ) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
