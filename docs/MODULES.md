# Modules

Permissions below come from `src/hooks/use-user-role.ts` and are mirrored by RLS
policies / `has_role()` checks in the database.

Role flags: `super_admin`, `admin` (super admin implies admin), `principal`,
`reception`, `teacher`, `staff`.

| Permission flag                                   | Granted to           |
| ------------------------------------------------- | -------------------- |
| `canCreateStudent`                                | admin, reception     |
| `canEditStudent`                                  | admin                |
| `canPromoteStudent`                               | admin, principal     |
| `canArchiveStudent`                               | admin                |
| `canViewStudent` / `canViewFees` / `canViewExams` | any user with a role |
| `canManageFeeStructures`                          | admin                |
| `canCollectFee`                                   | admin, reception     |
| `canVoidReceipt`                                  | admin                |
| `canApproveConcession`                            | admin, principal     |
| `canManageExams`                                  | admin, principal     |
| `canManageTeachers` / `canViewTeachers`           | super_admin only     |

Settings editing is **not** driven by these flags: every Settings tab receives
`canEdit={isSuperAdmin}`, so only a Super Admin can change school configuration.

Sidebar entries (`src/components/app-sidebar.tsx`): Dashboard, Students,
Promotion, Fee Management, Examinations, Activity Center, Settings, plus
Teachers for Super Admins. `/admissions`, `/attendance` and `/reports` exist as
routes but are intentionally not linked from the sidebar.

---

## 1. Dashboard — `/dashboard`

**Purpose:** at-a-glance operational summary.
**Features:** stat cards (students, fees, attendance, exams style counters) and a
"Claim admin role" banner that appears only for a signed-in user who has no role
yet and calls `claim_first_admin()`.
**Permissions:** any authenticated user.

## 2. Students — `/students`

**Purpose:** the student master and enrolment lifecycle.
**Screens**

- `/students` — list with free-text search (scholar number, name, father's
  name), session → class → section cascading filters (class disabled until a
  session is chosen, section until a class is chosen), pagination, and Import /
  New Admission actions.
- `/students/new` — admission form with mandatory-field validation; submit is
  disabled until valid; admission runs through `admit_student_with_fee_structure`.
- `/students/:id` — profile with tabs **Information, Academic History, Activity,
  Fees, Attendance, Documents**. The Activity tab is a derived timeline
  (profile created, admitted, status changes), not the global audit log. The
  Fees tab renders live ledger data via `student-fees-tab.tsx`. Documents can be
  viewed (signed URL) and replaced. Header actions: Back, Edit (admin), Promote
  (admin/principal), Archive (admin).
- `/students/:id/edit` — edit (admin only).
- `/students/import` — Excel import with template download, row validation and
  an import summary (created / skipped / failed with reasons).
- `/students/promote` — bulk promotion wizard (see below).

**Features:** scholar number continuity (max + 1), optional section when a class
has none, optional roll number, photo/document upload to the private `students`
bucket, "Mark Left" dialog (date + reason), archive dialog, "Link Fee Structure"
repair action for records without a structure.
**Dependencies:** academic sessions, classes, sections, houses, fee structures,
activity log.

## 3. Promotion — `/students/promote`

**Purpose:** move a whole class/session cohort to the next session.
**Features:** source session/class selection, destination session/class/section,
per-student action (Promote / Retain / Exclude), promotion settings step,
preview before commit, single-transaction commit via `bulk_promote_students`,
automatic fee-schedule generation for the new records, and alphabetical roll
number regeneration (`regenerate_roll_numbers_after_promotion`).
A single-student `PromoteDialog` is also available from the student profile.
**Permissions:** admin, principal.

## 4. Fee Management — `/fees`

**Purpose:** structures, ledgers, collection, receipts and reporting.

Sub-navigation (`components/fees/fees-tabs.tsx`): Dashboard · Fee Structures ·
Collect Fee · Receipts · Concessions · Opening Balance Migration · Settings.

**Screens**

- `/fees` — dashboard with five KPI cards (Today's Collection, This Month,
  Outstanding, Students with Pending Fee, Receipts Today), each linking to
  `/fees/report/<view>`, plus the 10 most recent receipts with clickable receipt
  numbers and a View action.
- `/fees/structures` and `/fees/structures/:structureId` — structure list with
  Draft/Complete status and the editor: per-head amount, frequency, applicable
  months, applicability, summary card, suggested collection amount, generate
  preview simulation, and structure lock.
- `/fees/collect` → `/fees/collect/:studentId` — student search, then the
  collection screen with tabs **Fee Schedule, Ledger, Payment History** and a
  collection dialog offering three modes: **Quick Collect** (auto allocation by
  priority), **Manual Allocation** (pick rows) and **Opening Balance Only**.
- `/fees/receipts` and `/fees/receipts/:paymentId` — receipt register with
  search/filters; detail view with allocation breakdown, print, and the
  Void Receipt workflow (mandatory reason, ledger reversal).
- `/fees/concessions` — record and approve concessions.
- `/fees/import` — Opening Balance Migration, tabs **Manual Entry**,
  **Bulk Import (Excel)** and **Opening Balance Report**. The importer downloads
  `opening-balance-breakup-template.xlsx`; the report exports
  `opening-balance-report.xlsx`. Editing requires `canManageFeeStructures`.
- `/fees/report/:view` — drill-down reports reached from the dashboard cards
  (`today`, `month`, `outstanding`, `pending`, `receipts`).
- `/fees/settings` — late fee settings and default collection mode.

**Permissions:** structures & opening-balance migration = admin;
collect = admin/reception; void = admin; concession approval = admin/principal;
viewing = any role.
**Dependencies:** fee heads (Settings), academic sessions/classes, student
academic records.

## 5. Examinations — `/examinations`

**Purpose:** examination masters (Phase 1 — configuration only).
**Screens**

- `/examinations` — landing page with cards for Subjects, Exam Patterns and
  Grade Scales, plus a disabled "Marks Entry — Available in Phase 2" card.
- `/examinations/subjects` — subject master plus class-subject mapping and
  per-subject assessment components (name, max marks, practical flag).
- `/examinations/grade-scales` — grade scales and non-overlapping bands.
- `/examinations/patterns` and `/examinations/patterns/:patternId` — versioned
  exam patterns: terms with weightage, applicable classes, grade scale, clone to
  another session, create new version, lock/unlock.

**Permissions:** manage = admin/principal/super_admin
(`can_manage_exam_masters`); view = any role.
**Not implemented:** marks entry, results and report cards.

## 6. Teachers — `/teachers`

**Purpose:** teacher/staff HR records (confidential).
**Screens:** `/teachers` list (search, status filter, archive toggle) and
`/teachers/:teacherId` with tabs **Profile, Documents, Activity** — basic
details, IDs, bank + salary, experience, private-bucket documents via signed
URLs, and masked account numbers.
**Features:** auto employee code `NKS-0000` via `next_employee_code()`,
Active/Inactive status, archive.
**Permissions:** Super Admin only — the sidebar entry and routes are hidden for
everyone else and RLS enforces the same.

## 7. Activity Center — `/activity`

**Purpose:** global audit trail.
**Features:** filter by module/action/date, human-readable summaries produced by
`src/lib/activity-format.ts`, user attribution joined to `profiles`.
**Writes:** modules call `logActivity()` (fire-and-forget) for admissions,
student edits, promotions, payments, voids, concessions, document changes and
opening-balance edits.
**Permissions:** role-scoped read; the log is append-only.

## 8. Settings — `/settings`

Tabbed screen, one component per tab in `src/components/settings/`:

| Tab               | Purpose                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| School Profile    | school identity and affiliation details                                                                                     |
| Academic Sessions | sessions with Draft/Active/Closed lifecycle                                                                                 |
| Classes           | classes per session with ordering                                                                                           |
| Sections          | sections per class                                                                                                          |
| Houses            | house master                                                                                                                |
| Fee Heads         | global fee heads: frequency, applicable months, applicability, auto-generate, charge trigger, mandatory, active, sort order |
| Users             | user list and role assignment (`user_roles`)                                                                                |
| System Health     | data-integrity checks (e.g. records missing fee structures)                                                                 |
| Data Migration    | entry point to the migration toolkit and live migration progress                                                            |

Only Super Admins can edit; everyone else sees a "View only" badge and the
read-only notice (`read-only-notice.tsx`).

## 9. Data Migration — `/migration`

Admin / Super Admin only (enforced by RLS and the migration RPCs).

| Route                  | Purpose                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `/migration`           | dashboard: record counts per entity, recommended import order                                            |
| `/migration/students`  | student migration wizard — template → upload → validate → preview → commit, with Excel error report      |
| `/migration/go-live`   | one-click readiness check (`go_live_validation()`)                                                       |
| `/migration/batches`   | batch history; rollback of the most recent batch only, blocked once operational transactions exist       |

Committed students automatically receive an academic record and a generated fee
schedule from the matching Active + Complete fee structure. Batches are tracked
in `migration_batches` / `migration_batch_items`. Full procedure:
[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) and
[DATA_IMPORT_ORDER.md](./DATA_IMPORT_ORDER.md).

## 10. Routes not linked in the sidebar


- `/admissions` — "Admission Register" screen with tabs **Admissions**,
  **Import Students** and **Reports**, covering admissions handled directly by
  the office. Reachable by URL only.
- `/attendance` — read-only daily attendance viewer: pick a date, see recorded
  rows from the `attendance` table. There is no marking UI.
- `/reports` — static grid of planned report cards (enrolment, fee collection,
  attendance, exam performance, fee dues, teacher workload). No report is
  generated from this screen; the working fee reports live under
  `/fees/report/:view`.
