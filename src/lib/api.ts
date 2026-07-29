const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
export const UPLOADS_BASE = API_BASE.replace(/\/api\/v1\/?$/, '');

interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  count?: number;
  total?: number;
  pagination?: { next?: { page: number; limit: number }; prev?: { page: number; limit: number } };
  token?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('crm_token');
  }

  setToken(token: string) {
    localStorage.setItem('crm_token', token);
  }

  clearToken() {
    localStorage.removeItem('crm_token');
  }

  private handleUnauthorized(): never {
    this.clearToken();
    localStorage.removeItem('crm_role');
    localStorage.removeItem('crm_user');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  private async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
      });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const isAuthEndpoint = path.startsWith('/auth/');
    if (res.status === 401 && !isAuthEndpoint) this.handleUnauthorized();

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  get<T>(path: string, params?: Record<string, string | number | undefined>) {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string, body?: unknown) {
    return this.request<T>('DELETE', path, body);
  }

  async getBlob(path: string): Promise<Blob> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (res.status === 401 && !path.startsWith('/auth/')) this.handleUnauthorized();
    if (!res.ok) throw new Error('Failed to load file');
    return res.blob();
  }

  async upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { method: 'POST', headers, body: formData });

    if (res.status === 401 && !path.startsWith('/auth/')) this.handleUnauthorized();

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Upload failed');
    return json;
  }
}

export const api = new ApiClient(API_BASE);
export type { ApiResponse };

export function getFileUrl(path: string | undefined): string {
  if (!path) return '';

  // 1. Direct full URLs (http, https, data URLs)
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }

  // 2. Frontend public static assets (e.g. /plots/plot_sketch_1.jpg, /logo.png)
  if (
    path.startsWith('/plots/') || path.startsWith('plots/') ||
    path.startsWith('/logo') || path.startsWith('logo') ||
    path.startsWith('/assets/') || path.startsWith('assets/')
  ) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // 3. S3 Direct URL pattern match
  const s3Match = path.match(/s3[.-][a-z0-9-]+\.amazonaws\.com\/([^/]+)\/(.+)$/i);
  if (s3Match) {
    const [, category, filename] = s3Match;
    return `${API_BASE}/uploads/file/${category}/${filename}`;
  }

  // 4. API uploads endpoint match
  const apiUploadsMatch = path.match(/\/api\/v\d+\/uploads\/(?:file\/)?([^/]+)\/(.+)$/);
  if (apiUploadsMatch) {
    const [, category, filename] = apiUploadsMatch;
    return `${API_BASE}/uploads/file/${category}/${filename}`;
  }

  // 5. Standard /uploads/category/filename or uploads/category/filename path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath.startsWith('/uploads/')) {
    const parts = normalizedPath.replace(/^\/uploads\//, '').split('/');
    if (parts.length >= 2) {
      const category = parts[0];
      const filename = parts.slice(1).join('/');
      return `${API_BASE}/uploads/file/${category}/${filename}`;
    }
  }

  // 6. Generic root-relative path fallback (if it starts with slash and is not uploads)
  if (path.startsWith('/')) {
    return path;
  }

  return `${API_BASE}/uploads/file/general/${path}`;
}
