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

// Materials
export const getMaterials = (params?: { type?: string; isActive?: boolean; search?: string }) =>
  api.get('/materials', { params }).then((r) => r.data);
export const getMaterial = (id: string) => api.get(`/materials/${id}`).then((r) => r.data);
export const createMaterial = (data: any) => api.post('/materials', data).then((r) => r.data);
export const updateMaterial = (id: string, data: any) => api.put(`/materials/${id}`, data).then((r) => r.data);
export const deleteMaterial = (id: string) => api.delete(`/materials/${id}`).then((r) => r.data);
export const getMaterialBarcodeUrl = (id: string): string => `/api/materials/${id}/barcode`;

// Stock
export const getStock = (propertyId: string) =>
  api.get(`/stock/${propertyId}`).then((r) => r.data);
export const getStockMovements = (
  propertyId: string,
  params?: { materialId?: string; type?: string; from?: string; to?: string },
) => api.get(`/stock/${propertyId}/movements`, { params }).then((r) => r.data);
export const getStockValuation = (propertyId: string) =>
  api.get(`/stock/${propertyId}/valuation`).then((r) => r.data);
export const createStockMovement = (data: any) =>
  api.post('/stock/movement', data).then((r) => r.data);
