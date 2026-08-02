# Future Integrations

How the planned modules in [ROADMAP.md](./ROADMAP.md) are expected to attach to
the v1.0.0 foundation **without** reshaping the core data model. Nothing here is
implemented.

## Shared integration principles

1. New modules add **new tables**; they do not add columns to `students`,
   `fee_payments` or `student_academic_records` unless unavoidable.
2. Everything hangs off `student_academic_records` (student + session + class +
   section), never off `students` directly — that is what makes a module
   session-aware for free.
3. Authorization follows the existing pattern: a capability flag in
   `src/lib/permissions.ts` mirrored by an RLS policy using `has_role()`.
4. Every user-visible action calls `logActivity()` with a new module name and a
   branch in `formatActivityDetails()`.
5. Multi-step or money-touching operations ship as `SECURITY DEFINER` functions.

## Examination — Phase 2 (marks and results)

**Already in place:** `exam_subjects`, `exam_class_subjects`,
`exam_class_subject_components`, `exam_patterns` (versioned + lockable),
`exam_pattern_terms` (weightage, include-in-final), `exam_pattern_classes`,
`exam_grade_scales`, `exam_grade_bands`.

**To add:** a marks table keyed by `(academic_record_id, term_id,
class_subject_component_id)` with the obtained mark, plus a results/publication
table for computed term and final aggregates.

**Integration points**

- Term totals apply `exam_pattern_terms.weightage_percent`; the final result uses
  only terms with `include_in_final`.
- Grades derive from the pattern's `exam_grade_scales` / `exam_grade_bands`
  (bands already have an anti-overlap trigger).
- Locked patterns must stay locked — `block_locked_pattern_write` already guards
  this; marks entry must refuse an unlocked pattern by policy decision.
- Report cards render from `school_profile` + academic record + computed result,
  reusing the receipt print approach (browser print, no server PDF — Worker
  runtime has no native rendering).
- Permissions: extend `canManageExams` with a marks-entry flag for `teacher`
  scoped to assigned classes.

## Attendance

**Already in place:** the `attendance` table (`student_id`, `class_id`, `date`,
`status`, `remarks`, `marked_by`) and a read-only viewer at `/attendance`.

**To add:** a marking UI (class + date → bulk status), a unique key on
`(student_id, date)` (plus period, if periods are introduced), and monthly
summary queries.

**Integration points**

- Mark against the student's active academic record so class/section come from
  the session, not from free-typed values.
- Add an Attendance tab to the student profile beside Fees.
- Teachers get marking rights for their classes; admins get school-wide rights.
- Feeds future report cards (attendance percentage) and any attendance-linked
  fee rules — which should be an explicit product decision, not implicit.

## Payroll

**Already in place:** `teachers.monthly_salary`, `salary_effective_from`, bank
fields, `formatSalary` / `maskAccount` helpers, private document bucket.

**To add:** salary components (allowances/deductions), a payroll run table per
month, and payslip rows per teacher per run.

**Integration points**

- Payroll inherits the Super-Admin-only restriction of the Teachers module
  (ADR-011); do not widen `teachers` RLS to build it.
- Reuse the immutability pattern from fees: a posted payroll run is voided, never
  deleted or edited.
- Keep salary history additive so an effective-dated change never rewrites a
  past payslip.

## Certificates

**To add:** a certificate issuance table (type, student, academic record, serial
number, issue date, issued_by, payload snapshot).

**Integration points**

- Transfer certificates read `date_of_leaving` / `reason_for_leaving`, already
  captured by the Mark Left dialog.
- Serial numbers use a sequence function in the style of `next_receipt_number()`.
- Snapshot the rendered values at issue time so a later data correction does not
  silently change an issued certificate.
- Printing follows the receipt pattern: a print-styled route, browser print.

## Consolidated Reports

**To add:** replace the static `/reports` page with real reports over existing
data — enrolment by class/session, fee collection and outstanding (extending
`/fees/report/$view`), attendance summaries, exam performance.

**Integration points**

- Prefer database views or RPCs for anything aggregating more than a few
  thousand rows; keep RLS-safe by using `SECURITY INVOKER` views or role-checked
  functions.
- Reuse the existing Excel export approach used by the opening balance report.

## Things a new module must not do

- Store a role anywhere outside `user_roles`.
- Add a delete path for financial records.
- Make a storage bucket public.
- Add a Node-only dependency (Cloudflare Worker runtime).
- Introduce a `module.tsx` layout route without `<Outlet />` (ADR-013).
- Edit an applied migration or the generated Supabase types.
