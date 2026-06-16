import axios from 'axios';

const getBaseURL = () => {
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
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        if (data.success) {
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
