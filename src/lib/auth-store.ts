import { UserAccount, PermissionKey } from './auth-types';

const STORAGE_CURRENT_USER_KEY = 'awp_active_session_user';

export function getActiveUser(): UserAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = sessionStorage.getItem(STORAGE_CURRENT_USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function setActiveUser(user: UserAccount | null): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  if (!user) sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  else sessionStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
}

export function hasPermission(user: UserAccount | null, permission: PermissionKey): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.permissions.includes(permission);
}
