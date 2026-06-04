import axios from 'axios';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  extraPermissions?: string[];
  hierarchyLevel: number;
  departmentId: string | null;
  departmentName?: string | null;
  branchId: string | null;
  branchName?: string | null;
  mfaEnabled?: boolean;
  mustChangePassword?: boolean;
}

export interface LoginResponse {
  user: AuthUser;
}

export const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCookie('govflow_csrf');
    if (csrfToken) {
      config.headers.set('x-csrf-token', csrfToken);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url = original?.url ?? '';
    const isAuthEndpoint = url.startsWith('/api/auth/');
    if (error.response?.status === 401 && !original?._retry && !isAuthEndpoint) {
      original._retry = true;
      await api.post('/api/auth/refresh');
      return api(original);
    }
    return Promise.reject(error);
  },
);

function getCookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length);
}

export async function getData<T>(url: string, params?: Record<string, unknown>) {
  const response = await api.get<ApiEnvelope<T>>(url, { params });
  return response.data.data;
}

export async function postData<T>(url: string, body?: unknown) {
  const response = await api.post<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function putData<T>(url: string, body?: unknown) {
  const response = await api.put<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function patchData<T>(url: string, body?: unknown) {
  const response = await api.patch<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function deleteData<T>(url: string) {
  const response = await api.delete<ApiEnvelope<T>>(url);
  return response.data.data;
}

export async function getBlob(url: string) {
  const response = await api.get<Blob>(url, { responseType: 'blob' });
  return response.data;
}

export async function uploadFile<T>(url: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiEnvelope<T>>(url, formData);
  return response.data.data;
}
