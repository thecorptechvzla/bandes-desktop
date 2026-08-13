import axios from 'axios';

// Sidecar local de NestJS: la única API que consume la app de escritorio.
export const SIDECAR_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001';

const TOKEN_KEY = 'bandes_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: `${SIDECAR_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('bandes_user');
        if (window.location.pathname !== '/login/') {
          window.location.href = '/login/';
        }
      }
    }
    const message = err.response?.data?.message || err.message || 'Error de conexión';
    console.error('[API Error]', message);
    return Promise.reject(err);
  },
);

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await api.post(path, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// Sube una foto al sidecar (bytea → BD central) y devuelve el id para photoUrl.
export async function uploadBlob(
  blob: Blob,
  entityType = 'BAR',
  entityId = '',
): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, `photo-${Date.now()}.jpg`);
  if (entityType) fd.append('entityType', entityType);
  if (entityId) fd.append('entityId', entityId);
  const { url } = await apiUpload<{ url: string }>('/blob/upload', fd);
  return url;
}

// URL completa para <img src>, con token por query (el guard lo acepta).
export function blobViewUrl(id?: string | null): string | null {
  if (!id) return null;
  const token = getAuthToken();
  const q = token ? `&token=${encodeURIComponent(token)}` : '';
  return `${SIDECAR_URL}/api/blob/view?url=${encodeURIComponent(id)}${q}`;
}