/**
 * Single source of truth for role-based permissions.
 *
 * UI code must never hand-roll role checks. Import `buildPermissions` (or the
 * `useUserRoles` hook, which wraps it) so every screen agrees on who may do
 * what. Database RLS policies and SECURITY DEFINER RPCs remain the enforcing
 * layer — this module only drives what the UI offers.
 */

export const APP_ROLES = [
  "super_admin",
  "admin",
  "teacher",
  "staff",
  "reception",
  "principal",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  principal: "Principal",
  teacher: "Teacher",
  reception: "Reception",
  staff: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full access, including settings, users and teacher records.",
  admin: "Manage students, fees, attendance, examinations and reports.",
  principal: "Approve concessions, promote students and manage examinations.",
  teacher: "Class-level operations such as attendance and marks entry.",
  reception: "Admit students and collect fees.",
  staff: "View-only staff access.",
};

export interface Permissions {
  roles: AppRole[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isReception: boolean;
  isPrincipal: boolean;
  isTeacher: boolean;
  hasAnyRole: boolean;

  // Students
  canCreateStudent: boolean;
  canEditStudent: boolean;
  canPromoteStudent: boolean;
  canArchiveStudent: boolean;
  canViewStudent: boolean;

  // Fees
  canManageFeeStructures: boolean;
  canCollectFee: boolean;
  canVoidReceipt: boolean;
  canApproveConcession: boolean;
  canManageOpeningBalance: boolean;
  canViewFees: boolean;

  // Examinations
  canManageExams: boolean;
  canViewExams: boolean;

  // Teachers (confidential HR data — Super Admin only)
  canManageTeachers: boolean;
  canViewTeachers: boolean;

  // Settings / administration
  canEditSettings: boolean;
  canInviteUsers: boolean;
  canViewActivityLog: boolean;
}

export function buildPermissions(rolesInput: readonly string[] | null | undefined): Permissions {
  const roles = (rolesInput ?? []).filter((r): r is AppRole =>
    (APP_ROLES as readonly string[]).includes(r),
  );
  const has = (r: AppRole) => roles.includes(r);

  const isSuperAdmin = has("super_admin");
  const isAdmin = has("admin") || isSuperAdmin;
  const isReception = has("reception");
  const isPrincipal = has("principal");
  const isTeacher = has("teacher");
  const hasAnyRole = roles.length > 0;

  return {
    roles,
    isSuperAdmin,
    isAdmin,
    isReception,
    isPrincipal,
    isTeacher,
    hasAnyRole,

    // RC-1: Reception can admit students but cannot edit them afterwards.
    canCreateStudent: isAdmin || isReception,
    canEditStudent: isAdmin,
    canPromoteStudent: isAdmin || isPrincipal,
    canArchiveStudent: isAdmin,
    canViewStudent: hasAnyRole,

    canManageFeeStructures: isAdmin,
    canCollectFee: isAdmin || isReception,
    canVoidReceipt: isAdmin,
    canApproveConcession: isAdmin || isPrincipal,
    canManageOpeningBalance: isAdmin,
    canViewFees: hasAnyRole,

    canManageExams: isAdmin || isPrincipal,
    canViewExams: hasAnyRole,

    canManageTeachers: isSuperAdmin,
    canViewTeachers: isSuperAdmin,

    canEditSettings: isSuperAdmin,
    canInviteUsers: isSuperAdmin,
    canViewActivityLog: isAdmin || isPrincipal,
  };
}
