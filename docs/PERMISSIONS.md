# Permissions

The **only** source of truth for UI capabilities is
`buildPermissions()` in `src/lib/permissions.ts`, consumed through the
`useUserRoles()` hook (`src/hooks/use-user-role.ts`). Never hand-roll a role
check in a component.

The database is the enforcing layer: every capability below has a matching RLS
policy or `has_role()` check inside a `SECURITY DEFINER` function. The UI only
decides what to *offer*.

## Roles

| Role | Label | Intent |
| --- | --- | --- |
| `super_admin` | Super Admin | Full access, including settings, users and teacher records |
| `admin` | Admin | Students, fees, attendance, examinations and reports |
| `principal` | Principal | Approve concessions, promote students, manage examinations |
| `teacher` | Teacher | Class-level operations (attendance, marks entry — future) |
| `reception` | Reception | Admit students and collect fees |
| `staff` | Staff | View-only staff access |

`super_admin` implies `admin` in UI checks (`isAdmin = has("admin") || isSuperAdmin`).
A user may hold multiple roles; capabilities are the union.

## Capability matrix

| Flag | super_admin | admin | principal | reception | teacher | staff |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `canViewStudent` / `canViewFees` / `canViewExams` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `canCreateStudent` | ✅ | ✅ | — | ✅ | — | — |
| `canEditStudent` | ✅ | ✅ | — | — | — | — |
| `canPromoteStudent` | ✅ | ✅ | ✅ | — | — | — |
| `canArchiveStudent` | ✅ | ✅ | — | — | — | — |
| `canManageFeeStructures` | ✅ | ✅ | — | — | — | — |
| `canCollectFee` | ✅ | ✅ | — | ✅ | — | — |
| `canVoidReceipt` | ✅ | ✅ | — | — | — | — |
| `canApproveConcession` | ✅ | ✅ | ✅ | — | — | — |
| `canManageOpeningBalance` | ✅ | ✅ | — | — | — | — |
| `canManageExams` | ✅ | ✅ | ✅ | — | — | — |
| `canManageTeachers` / `canViewTeachers` | ✅ | — | — | — | — | — |
| `canEditSettings` | ✅ | — | — | — | — | — |
| `canInviteUsers` | ✅ | — | — | — | — | — |
| `canViewActivityLog` | ✅ | ✅ | ✅ | — | — | — |

The view flags require `hasAnyRole` — a signed-in user with **no** role sees only
the Dashboard and the "Claim admin role" banner (which works only while no
super admin exists).

Notable deliberate decisions:

- **RC-1:** Reception may *admit* a student but may not edit one afterwards.
- **Teachers are Super Admin only** — confidential HR and salary data. The
  sidebar entry, the routes and the RLS policy all agree; do not widen any of
  them independently.
- **Settings editing is Super Admin only.** Every settings tab receives
  `canEdit={isSuperAdmin}`; other roles see the read-only notice.

## Database mirror

| UI capability | Database enforcement |
| --- | --- |
| `canCreateStudent` | RLS on `students` / `student_academic_records`; `admit_student_with_fee_structure()` re-checks the role |
| `canPromoteStudent` | `bulk_promote_students()`, `regenerate_class_roll_numbers()` role checks |
| `canCollectFee` | RLS on `fee_payments` / `fee_payment_allocations` + validation triggers |
| `canVoidReceipt` | RLS update policy on `fee_payments`; DELETE denied for everyone |
| `canManageFeeStructures` | RLS on `fee_structures`, `fee_structure_items`, `fee_heads`, `opening_balance_details` |
| `canManageExams` | `can_manage_exam_masters()` used by exam-table policies |
| `canManageTeachers` | `has_role(auth.uid(),'super_admin')` on `teachers`, `teacher_documents` and the storage bucket |
| `canInviteUsers` | `invite_user()` security-definer RPC + `user_invitations` policies |
| `canViewActivityLog` | role-scoped SELECT policy on `activity_log` |

## Adding a capability

1. Add the flag to the `Permissions` interface and to `buildPermissions()`.
2. Add or extend the matching RLS policy / `has_role()` check in a **new**
   migration.
3. Add a case to `src/lib/__tests__/permissions.test.ts`.
4. Update this table and [MODULES.md](./MODULES.md).
