import { UserAccount, PermissionKey, ALL_PERMISSIONS } from './auth-types';

const STORAGE_USERS_KEY = 'awp_users_registry';
const STORAGE_CURRENT_USER_KEY = 'awp_active_session_user';

export const DEFAULT_ADMIN: UserAccount = {
  id: 'admin_default_id',
  name: 'Administrador',
  email: 'admin@allwhatspy.com',
  role: 'admin',
  permissions: ALL_PERMISSIONS.map((p) => p.key),
  createdAt: '01/01/2026',
};

export function getStoredUsers(): UserAccount[] {
  if (typeof window === 'undefined') return [DEFAULT_ADMIN];
  try {
    const saved = localStorage.getItem(STORAGE_USERS_KEY);
    if (!saved) {
      saveStoredUsers([DEFAULT_ADMIN]);
      return [DEFAULT_ADMIN];
    }
    const users: UserAccount[] = JSON.parse(saved);
    // Ensure default admin exists
    if (!users.some((u) => u.email === DEFAULT_ADMIN.email)) {
      users.unshift(DEFAULT_ADMIN);
      saveStoredUsers(users);
    }
    return users;
  } catch {
    return [DEFAULT_ADMIN];
  }
}

export function saveStoredUsers(users: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

export function getActiveUser(): UserAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function setActiveUser(user: UserAccount | null): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  } else {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
  }
}

export function hasPermission(user: UserAccount | null, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.permissions ? user.permissions.includes(permission) : false;
}
