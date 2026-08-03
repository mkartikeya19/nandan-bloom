# Changelog

All notable changes to the Nandan Kids School ERP are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased] — 2026-08-03 — _Migration Toolkit & Security Hardening_

### Added — School Migration & Go-Live Toolkit (RC-3.8)

- **Migration Dashboard (`/migration`)** — live record counts for every master
  and transactional entity, recommended import order and prerequisite guidance.
- **Student Migration Wizard (`/migration/students`)** — download template →
  upload Excel → validate → preview → commit. Academic records and the current
  fee schedule are generated automatically for every imported student.
  Invalid rows can be exported as an Excel error report.
- **Go-Live Validation (`/migration/go-live`)** — one-click readiness check
  (`go_live_validation()` RPC): active session, complete fee structures, active
  students, generated schedules, unique scholar numbers.
- **Migration Batches (`/migration/batches`)** — batch history and rollback of
  the most recent batch (`rollback_migration_batch()`), blocked once
  operational transactions exist.
- **Settings → Data Migration** tab linking the whole toolkit.
- New tables `migration_batches` and `migration_batch_items` (Admin /
  Super Admin RLS, GRANTs, append-only semantics).
- New service `src/services/migration.service.ts`; new components
  `migration-tabs.tsx`, `migration-progress.tsx`.
- New docs: `MIGRATION_GUIDE.md`, `DATA_IMPORT_ORDER.md`.

### Changed — Security hardening

- **Least-privilege reads.** `USING (true)` SELECT policies removed from
  `students`, `student_academic_records`, `student_fee_schedule`, `admissions`,
  `fee_payments`, `fee_payment_allocations`, `fee_concessions` and
  `opening_balance_details`. Financial tables are now readable by
  `super_admin`, `admin`, `reception`, `principal`; student and academic
  records additionally by `teacher`.
- **Storage.** `students` bucket UPDATE/DELETE policies now verify that the
  scholar number in the object path matches a real student record.
- **Function lockdown.** `EXECUTE` revoked from `PUBLIC` and `anon` on all
  `SECURITY DEFINER` functions in `public`; 17 staff RPCs explicitly granted to
  `authenticated`.
- **RPC guards.** `bulk_promote_students` and `generate_student_fee_schedule`
  now enforce role checks inside the function body.

### Fixed — Quality gates (RC-3.7)

- Repository-wide Prettier/ESLint formatting remediation (91 files, whitespace
  and wrapping only — no behavioural change).
- Regex escaping fixed in `src/lib/students-helpers.ts` and
  `src/lib/teachers-helpers.ts`.
- `any` types removed from `fee-heads-tab.tsx`, `student-fees-tab.tsx`,
  `student-form.tsx`, `admissions.tsx`, `fees.receipts.index.tsx`.
- `src/integrations/supabase/types.ts` added to `.prettierignore`.
- **Lint gate is now green:** 0 errors, 9 accepted
  `react-refresh/only-export-components` warnings.

### Verification (local, 3 August 2026)

`verify:migrations` PASS (30 migrations) · `typecheck` PASS · `lint` 0 errors /
9 warnings · `test` 30/30 PASS · `build` PASS.

## [1.0.0] — 2026-08-02 — _Core ERP Foundation_

First production release. Everything below is implemented and verified
(typecheck, unit tests, migration verification, production build).

### Added — Modules

**Dashboard (`/dashboard`)**

- Operational stat cards and a one-time "Claim admin role" bootstrap banner
  backed by `claim_first_admin()`.

**Student Management (`/students`)**

- Student master with search (scholar number, name, father's name), cascading
  session → class → section filters and pagination.
- Admission workflow (`/students/new`) with mandatory-field validation, disabled
  submit until valid, optional section (when the class has none) and optional
  roll number.
- Single-transaction admission through `admit_student_with_fee_structure()`:
  student → academic record → fee structure link → fee schedule.
- Scholar number continuity (`next_scholar_number()` = max + 1).
- Student profile with Information, Academic History, Activity, Fees,
  Attendance and Documents tabs.
- Document upload / view / replace via the private `students` bucket and
  short-lived signed URLs.
- Excel import (`/students/import`) with template download, per-row validation
  and a created / skipped / failed summary.
- Status lifecycle: Active, Left, Passed Out, Inactive, with a Mark Left dialog
  capturing `date_of_leaving` and `reason_for_leaving`; archive dialog.
- "Link Fee Structure" repair action for academic records without a structure.

**Promotion (`/students/promote`)**

- Bulk promotion wizard: source selection, promotion settings, per-student
  Promote / Retain / Exclude, preview, and single-transaction commit via
  `bulk_promote_students()`.
- Automatic fee-schedule generation for new records and alphabetical roll number
  regeneration.
- Single-student promote dialog from the student profile.

**Fee Management (`/fees`)**

- Global fee heads with frequency, applicable months, applicability,
  auto-generate, charge trigger, mandatory and active flags.
- Fee structures per session + class with a per-head editor, summary card,
  Draft/Complete status, suggested collection amount, generate-preview
  simulation and structure lock.
- Idempotent fee schedule generation (`generate_student_fee_schedule()`),
  July→April tuition window (May and June are never billed).
- Opening balance on the academic record plus an itemised
  `opening_balance_details` breakup, exposed as "View Breakup" in the ledger.
- Opening Balance Migration utility (`/fees/import`): manual entry, Excel bulk
  import and an opening balance report with Excel export.
- Fee collection with three modes — Quick Collect (priority auto-allocation),
  Manual Allocation and Opening Balance Only — with allocation preview.
- Deterministic allocation priority: Opening Balance → Admission → Activities →
  Monthly (chronological) → Other charges → Optional.
- Receipt register (`/fees/receipts`) with search and filters, receipt detail
  screen with allocation breakdown and print, and a void workflow (mandatory
  reason, ledger reversal by trigger).
- Concessions (amount or percentage, per head or all heads) with approval.
- Fee dashboard with five KPI cards linking to drill-down reports
  (`/fees/report/:view`) and the ten most recent receipts.
- Fee settings: late fee configuration and default collection mode.

**Teacher Management (`/teachers`)** — Super Admin only

- Teacher records: basic details, government IDs, bank details (masked account
  number), salary and effective date, experience and previous school.
- Auto employee code `NKS-0001…` via `next_employee_code()`.
- Active / Inactive status and archive toggle.
- Documents in the private `teacher-documents` bucket via signed URLs.

**Examinations (`/examinations`)** — configuration only (Phase 1)

- Subject master, class-subject mapping with assessment components, grade scales
  with non-overlapping bands, and versioned exam patterns (terms, weightage,
  applicable classes, clone, new version, lock).

**Activity Center (`/activity`)**

- Global append-only audit log with module/action/date filters, user attribution
  and human-readable summaries.

**Settings (`/settings`)** — Super Admin editable

- School profile, academic sessions (Draft/Active/Closed), classes, sections,
  houses, fee heads, users & roles, invitations and system health checks.

### Security

- Public sign-up disabled; onboarding is **invitation-only**. Super Admins invite
  staff from Settings → Users; `user_invitations` records email, roles, inviter
  and expiry, and `handle_new_user()` grants the invited roles on first sign-in.
- Row Level Security enabled with explicit `GRANT`s on every `public` table.
- Roles stored exclusively in `user_roles`, read through the security-definer
  `has_role()` — no role data on `profiles` or `students`.
- Teacher HR data restricted to Super Admin in both UI and RLS.
- Database-enforced financial validation (`validate_fee_payment`,
  `validate_fee_payment_allocation`): positive amounts, immutable
  `receipt_number` and `amount`, allocations may never exceed the row's
  outstanding balance or the receipt total.
- `fee_payments` DELETE denied — corrections are void-and-repost only.
- `activity_log` UPDATE/DELETE denied — append-only.
- Both storage buckets are private; files are only served through short-lived
  signed URLs.
- Only one `Active` academic session at a time (partial unique index + status
  transition trigger).

### Performance

- Foreign-key indexes added across the fee, student and academic-record tables.
- Fee schedule generation is idempotent and set-based, so repeated refreshes are
  cheap.
- TanStack Query caching with descriptive keys and `staleTime` on master data.

### Fixed

- Routing: modules with children now use the `*.index.tsx` convention; Students,
  Fees, Fee Collect and Fee Structures no longer swallow their child routes.
- Fee allocation ordering follows the academic year (July → April) instead of
  calendar order.
- Admission enum mismatch (`student_admission_type`) resolved with explicit
  casts in the admission RPC.
- Promotion wizard destination dropdowns no longer render empty.
- "Post Payment" button blocked by a Radix focus conflict.
- Receipt page referenced a non-existent `school_name` column; the column is
  `school_profile.name`.
- Hydration mismatches from locale-dependent date rendering, fixed by the
  standard formatters in `src/lib/date.ts`.
- Orphan academic records without a fee structure repaired and prevented.

### Database changes

- New tables: `activity_log`, `opening_balance_details`, `user_invitations`,
  exam masters (`exam_subjects`, `exam_class_subjects`,
  `exam_class_subject_components`, `exam_grade_scales`, `exam_grade_bands`,
  `exam_patterns`, `exam_pattern_terms`, `exam_pattern_classes`),
  `teacher_documents`.
- Extended: `fee_heads` (business-rule columns), `fee_structure_items`
  (`applicability`), `fee_settings` (`default_collection_mode`),
  `academic_sessions` (`status`, `closed_at`, `closed_by`), `students`
  (leaving details, documents), `teachers` (bank, salary, experience, archive).
- New RPCs: `admit_student_with_fee_structure`, `bulk_promote_students`,
  `generate_student_fee_schedule`, `find_complete_fee_structure`,
  `is_fee_structure_complete`, `link_academic_record_fee_structure`,
  `regenerate_class_roll_numbers`, `regenerate_roll_numbers_after_promotion`,
  `clone_exam_pattern`, `version_exam_pattern`, `invite_user`,
  `next_scholar_number`, `next_employee_code`, `next_receipt_number`,
  `can_manage_exam_masters`, `claim_first_admin`.
- New triggers: session transition validation, section↔class validation,
  academic-record fee-structure validation, schedule recomputation on
  allocation and on void, grade band overlap, locked pattern protection,
  payment and allocation validation.
- Storage: private `students` and `teacher-documents` buckets.

### Documentation

- Full `/docs` set: README, ARCHITECTURE, DATABASE, MODULES, BUSINESS_RULES,
  PERMISSIONS, SECURITY, WORKFLOW, API, TESTING, DEPLOYMENT, CONTRIBUTING,
  DECISIONS, FUTURE_INTEGRATIONS, ROADMAP, RELEASE_NOTES and this CHANGELOG.

### Breaking changes

Relative to pre-release builds (no earlier tagged release exists):

- Public sign-up removed — existing anonymous sign-up links stop working.
- Partial payments rejected in every collection mode.
- Receipt editing and deletion removed in favour of void-and-repost.
- Fee head "School Monthly Maintenance Fee" renamed to
  **School Management Fee (SMF)**.
- Admission without exactly one Active + Complete fee structure for the
  session/class is blocked.
- Route files renamed to the `*.index.tsx` convention; deep links are unchanged
  but any code importing the old files must be updated.
