import axios from 'axios';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/otp');
    if (err.response?.status === 401 && !isAuthRoute) {
      authToken = null;
      // Notify AuthContext so it can show the "session expired" modal
      // before redirecting — avoids a hard navigation that loses React state.
      window.dispatchEvent(new CustomEvent('rentcrm:session-expired'));
    }
    return Promise.reject(err);
  }
);
