const TOKEN_KEY = 'intranet_token';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  author: string | null;
  created_at: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Relative URL: nginx proxies /api to the backend in production; the Vite dev
  // server proxies it during local development.
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Erro HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function login(username: string, password: string): Promise<{ token: string; user: User }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchMe(): Promise<User> {
  return request('/users/me');
}

export function fetchUsers(): Promise<User[]> {
  return request('/users');
}

export function fetchAnnouncements(): Promise<Announcement[]> {
  return request('/announcements');
}
