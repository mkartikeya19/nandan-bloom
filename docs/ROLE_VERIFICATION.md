# Role Verification Matrix — v1.0.0

Two columns matter here:

- **Declared** — provable from the repository: `src/lib/permissions.ts`
  (single source of truth, covered by `src/lib/__tests__/permissions.test.ts`)
  and the RLS policies / `has_role()` checks in `supabase/migrations/`.
- **Verified in production** — requires signing in as a real account holding
  that role. **Not performed.** Every cell below is `Pending`.

Roles: `super_admin`, `admin`, `principal`, `teacher`, `reception`, `staff`.
`admin` is implied by `super_admin`.

---

## 1. Capability matrix (declared)

Legend: ✔ allowed · ✖ not allowed · *(view)* read-only.

| Capability | Super Admin | Admin | Principal | Reception | Teacher | Staff |
| --- | --- | --- | --- | --- | --- | --- |
| View students | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Create student (admission) | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ |
| Edit student | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Promote students | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Archive / mark left | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| View fees | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Manage fee structures | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Collect fee | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ |
| Void receipt | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Approve concession | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Manage opening balances | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| View examinations | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Manage examination masters | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| View / manage teachers | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Edit settings | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Invite users | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ |
| View activity log | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |

Notes:
- **RC-1 rule:** Reception may admit a student but may not edit one afterwards.
- **Teachers module is Super Admin only** — sidebar entry, route guard and RLS.
- A user with **no** role sees no module content (`hasAnyRole` gates viewing).

## 2. Database mirror (declared)

| Enforcement | Where |
| --- | --- |
| Role storage | `public.user_roles` only — never on `profiles` or `students` |
| Role check | `public.has_role(uuid, app_role)` — `SECURITY DEFINER`, `STABLE` |
| Exam masters | `public.can_manage_exam_masters()` → admin / super_admin / principal |
| Admission | `admit_student_with_fee_structure()` → admin / super_admin / reception |
| Fee-structure linking | `link_academic_record_fee_structure()` → admin / super_admin |
| Roll-number regeneration | `regenerate_class_roll_numbers()` → admin / super_admin / principal |
| Invitations | `invite_user()` → super_admin only |
| First-admin bootstrap | `claim_first_admin()` → any authenticated user, but only while no `super_admin` exists |
| Student documents | `students` bucket policies (read all roles; write admin/super_admin/reception) |
| Teacher documents | `teacher-documents` bucket policies (super_admin only) |

## 3. Production verification log

Sign in as one account per role and record the result. Do not mark a row
verified without an observed result.

| # | Role | Test | Expected | Result | Verified by | Date |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Super Admin | Sidebar contents | Settings and Teachers visible | Pending | | |
| 2 | Super Admin | Settings → Users → Invite | Invitation created, temp password shown once | Pending | | |
| 3 | Admin | Open `/teachers` by URL | Access denied / not rendered | Pending | | |
| 4 | Admin | Void a receipt | Allowed, reason mandatory, ledger reversed | Pending | | |
| 5 | Principal | Promote students | Allowed | Pending | | |
| 6 | Principal | Edit a student | Not offered | Pending | | |
| 7 | Principal | Approve concession | Allowed | Pending | | |
| 8 | Reception | Admit a student | Allowed | Pending | | |
| 9 | Reception | Edit that student afterwards | Not offered (RC-1) | Pending | | |
| 10 | Reception | Collect a fee | Allowed | Pending | | |
| 11 | Reception | Void a receipt | Not offered | Pending | | |
| 12 | Reception | Open `/activity` | No access | Pending | | |
| 13 | Teacher | Fees screens | Read-only, no Collect action | Pending | | |
| 14 | Staff | Any module | View-only, no create/edit actions | Pending | | |
| 15 | No role | Sign in | No module content available | Pending | | |

**Status: Role verification pending.** The declared matrix is covered by unit
tests; production behaviour has not been observed.
