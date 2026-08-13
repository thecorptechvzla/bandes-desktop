import { api, getAuthToken } from './api';

export interface SessionUser {
  id: string;
  username: string;
  role: string;
  loginAt: string;
}

const TOKEN_KEY = 'bandes_token';
const USER_KEY = 'bandes_user';

export async function login(username: string, password: string): Promise<SessionUser> {
  const { data } = await api.post<{
    token: string;
    user: { id: string; username: string; role: string };
  }>('/auth/login', { username, password });

  localStorage.setItem(TOKEN_KEY, data.token);
  const user: SessionUser = { ...data.user, loginAt: new Date().toISOString() };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem('bandes_user_role', data.user.role);
  return user;
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('bandes_user_role');
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  logout();
}