/**
 * Pure guard rules for the user lifecycle. The database enforces the same rules
 * inside `admin_set_user_active`, `admin_set_user_roles` and `admin_delete_user`;
 * these helpers exist so the UI never offers an action that must fail.
 */

export interface LifecycleUser {
  id: string;
  isActive: boolean;
  roles: readonly string[];
}

export function countActiveSuperAdmins(users: readonly LifecycleUser[]): number {
  return users.filter((u) => u.isActive && u.roles.includes("super_admin")).length;
}

/** Deactivation is blocked for yourself and for the last active Super Admin. */
export function canDeactivate(
  target: LifecycleUser,
  currentUserId: string | null,
  activeSuperAdmins: number,
): boolean {
  if (!target.isActive) return false;
  if (target.id === currentUserId) return false;
  if (target.roles.includes("super_admin") && activeSuperAdmins <= 1) return false;
  return true;
}

/** Removing the Super Admin role is blocked for yourself and for the last one. */
export function canRemoveSuperAdmin(
  target: LifecycleUser,
  currentUserId: string | null,
  activeSuperAdmins: number,
): boolean {
  if (!target.roles.includes("super_admin")) return true;
  if (target.id === currentUserId) return false;
  return activeSuperAdmins > 1;
}

/** You may never delete your own account. */
export function canAttemptDelete(target: LifecycleUser, currentUserId: string | null): boolean {
  return target.id !== currentUserId;
}
