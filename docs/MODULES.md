# Modules

Permissions below come from `src/hooks/use-user-role.ts` and are mirrored by RLS
policies / `has_role()` checks in the database.

Role flags: `super_admin`, `admin` (super admin implies admin), `principal`,
`reception`, `teacher`, `staff`.

| Permission flag | Granted to |
| --- | --- |
| `canCreateStudent` | admin, reception |
| `canEditStudent` | admin |
| `canPromoteStudent` | admin, principal |
| `canArchiveStudent` | admin |
| `canViewStudent` / `canViewFees` / `canViewExams` | any user with a role |
| `canManageFeeStructures` | admin |
| `canCollectFee` | admin, reception |
| `canVoidReceipt` | admin |
| `canApproveConcession` | admin, principal |
| `canManageExams` | admin, principal |
| `canManageTeachers` / `canViewTeachers` | super_admin only |

---

## 1. Dashboard — `/dashboard`
**Purpose:** at-a-glance operational summary.
**Features:** headline counts (students, collections, dues) and quick links.
**Permissions:** any authenticated user with a role.
**Depends on:** students, fee payments, fee schedule.

## 2. Students — `/students`
**Purpose:** the student master and enrolment lifecycle.
**Screens**
- `/students` — searchable, session/class/section-filtered list.
- `/students/new` — admission form with mandatory-field validation; submit is
  disabled until valid; admission runs through `admit_student_with_fee_structure`.
- `/students/:id` — profile with tabs: details, documents, academic record,
  **Fees** (live ledger via `student-fees-tab.tsx`), activity.
- `/students/:id/edit` — edit (admin only).
- `/students/import` — Excel import with template download, row validation and
  an import summary (created / skipped / failed with reasons).
- `/students/promote` — bulk promotion wizard (see below).

**Features:** scholar number continuity (max + 1), optional section when a class
has none, optional roll number, photo/document upload to the private `students`
bucket, "Mark Left" dialog (date + reason), archive dialog, "Link Fee Structure"
repair action for records without a structure.
**Permissions:** create = admin/reception; edit/archive = admin; view = any role.
**Dependencies:** academic sessions, classes, sections, houses, fee structures,
activity log.

## 3. Promotion — `/students/promote`
**Purpose:** move a whole class/session cohort to the next session.
**Features:** source session/class selection, destination session/class/section,
per-student action (Promote / Retain / Exclude), promotion settings step,
preview before commit, single-transaction commit via `bulk_promote_students`,
automatic fee-schedule generation for the new records, and alphabetical roll
number regeneration (`regenerate_roll_numbers_after_promotion`).
**Permissions:** admin, principal.

## 4. Fee Management — `/fees`
**Purpose:** structures, ledgers, collection, receipts and reporting.

**Screens (tabs via `components/fees/fees-tabs.tsx`)**
- `/fees` — dashboard: KPI cards (clickable → reports), recent receipts with
  clickable receipt numbers and a View action.
- `/fees/structures` and `/fees/structures/:id` — structure list with
  Draft/Complete status and the editor: per-head amount, frequency, applicable
  months, applicability, summary card, suggested collection amount, generate
  preview simulation, and structure lock.
- `/fees/collect` → `/fees/collect/:studentId` — collection screen with three
  modes: **Quick Collect** (auto allocation by priority, full payment enforced),
  **Manual Allocation** (pick rows; full settlement of chosen rows enforced) and
  **Opening Balance Only**.
- `/fees/receipts` and `/fees/receipts/:paymentId` — receipt register with
  search/filters; detail view with allocation breakdown, print, and the
  Void Receipt workflow (mandatory reason, ledger reversal).
- `/fees/concessions` — record and approve concessions.
- `/fees/import` — Opening Balance migration utility: manual entry with breakup
  rows, Excel bulk import (multiple breakup rows per scholar number), and the
  Opening Balance report with drill-down.
- `/fees/report/:view` — drill-down reports reached from dashboard cards.
- `/fees/settings` — late fee settings and default collection mode.

**Permissions:** structures = admin; collect = admin/reception; void = admin;
concession approval = admin/principal; viewing = any role.
**Dependencies:** fee heads (Settings), academic sessions/classes, student
academic records.

## 5. Examinations — `/examinations`
**Purpose:** examination masters (Phase 1 — configuration only).
**Screens**
- `/examinations` — module landing/navigation.
- `/examinations/subjects` — subject master plus class-subject mapping and
  per-subject assessment components (name, max marks, practical flag).
- `/examinations/grade-scales` — grade scales and non-overlapping bands.
- `/examinations/patterns` and `/examinations/patterns/:patternId` — versioned
  exam patterns: terms with weightage, applicable classes, grade scale, clone to
  another session, create new version, lock/unlock.

**Permissions:** manage = admin/principal (`can_manage_exam_masters`); view = any role.
**Not implemented:** marks entry, results and report cards.

## 6. Teachers — `/teachers`
**Purpose:** teacher/staff HR records (confidential).
**Screens:** `/teachers` list (search, status filter, archive toggle) and
`/teachers/:teacherId` profile with basic details, IDs, bank + salary, experience
and the documents tab (private bucket, signed URLs, masked account numbers).
**Features:** auto employee code `NKS-0000` via `next_employee_code()`,
Active/Inactive status, archive.
**Permissions:** Super Admin only — the sidebar entry and routes are hidden for
everyone else and RLS enforces the same.

## 7. Activity Center — `/activity`
**Purpose:** global audit trail.
**Features:** filter by module/action/date, human-readable summaries produced by
`src/lib/activity-format.ts`, user attribution joined to `profiles`.
**Writes:** every module calls `logActivity()` (fire-and-forget) for creates,
edits, admissions, promotions, payments, voids, concessions, document changes
and opening-balance edits.
**Permissions:** role-scoped read; the log is append-only.

## 8. Settings — `/settings`
Tabbed screen, one component per tab in `src/components/settings/`:

| Tab | Purpose |
| --- | --- |
| School Profile | school identity and affiliation details |
| Sessions | academic sessions with Draft/Active/Closed lifecycle |
| Classes | classes per session with ordering |
| Sections | sections per class |
| Houses | house master |
| Fee Heads | global fee heads: frequency, applicable months, applicability, auto-generate, charge trigger, mandatory, active, sort order |
| Users | user list and role assignment (`user_roles`) |
| System Health | data-integrity checks (e.g. records missing fee structures) |

Non-admins see a read-only notice (`read-only-notice.tsx`).

## 9. Placeholder / hidden modules
`admissions.tsx` (admission register scaffold), `attendance.tsx` and
`reports.tsx` exist as routes but are hidden from the sidebar and are not part of
the shipped feature set.
