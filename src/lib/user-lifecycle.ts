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

/**
 * Hard-delete state machine (D5).
 *
 * Supabase Auth and PostgreSQL cannot take part in one atomic transaction, so
 * the deletion is ordered fail-safe instead: the login is banned BEFORE any
 * application row is removed. Every failure therefore leaves the target
 * inactive and banned — never restored — and the workflow can be retried with
 * the same Auth user id.
 */
export const DEACTIVATION_ATTRIBUTION_BLOCKER = "Deactivated other staff accounts";

export interface DeletionProgress {
  /** Auth account ban confirmed by re-reading the user. */
  banned: boolean;
  /** Application rows (roles, profile) removed and the audit entry written. */
  recordsRemoved: boolean;
  /** auth.users row deleted. */
  authDeleted: boolean;
}

export type DeletionState = "User Deletion Started" | "User Deletion Failed" | "User Deleted";

export function deletionState(p: DeletionProgress): DeletionState {
  if (p.banned && p.recordsRemoved && p.authDeleted) return "User Deleted";
  if (!p.banned && !p.recordsRemoved && !p.authDeleted) return "User Deletion Started";
  return "User Deletion Failed";
}

/** A failed deletion is always retryable; a completed one never is. */
export function isDeletionRetryable(p: DeletionProgress): boolean {
  return deletionState(p) !== "User Deleted";
}

/** Access must never be restored automatically after a partial failure. */
export function shouldRemainBanned(p: DeletionProgress): boolean {
  return p.banned;
}
