# Business Rules

Every rule below is enforced today, either in the database (trigger, constraint
or `SECURITY DEFINER` function) or in the UI layer. The enforcement point is
noted so you know what can and cannot be bypassed.

## Roles & permissions

- Roles live only in `user_roles`; never on `profiles` or `students`. *(DB)*
- `super_admin` implies `admin` in UI permission checks. *(UI: `use-user-role.ts`)*
- The first authenticated user may call `claim_first_admin()` to become
  `admin` + `super_admin` — only while no super admin exists. *(DB)*
- Teacher records are Super Admin only, in both the sidebar/routes and RLS. *(UI + DB)*
- **Settings is Super Admin editable only** — every tab receives
  `canEdit={isSuperAdmin}`; other roles get a "View only" badge. *(UI)*
- The Dashboard "Claim admin role" banner shows only for a signed-in user with
  no role, and `claim_first_admin()` refuses once a super admin exists. *(UI + DB)*
- Permission matrix: see [MODULES.md](./MODULES.md).

## Academic sessions

- Status is one of `Draft`, `Active`, `Closed`; `is_active` is derived from it. *(DB trigger)*
- **Only one Active session** at any time. *(DB partial unique index)*
- Allowed transitions: Draft→Active, Active→Closed, Active→Draft, Closed→Draft.
  Closed→Active and Draft→Closed are rejected. *(DB trigger)*
- Classes belong to a session; sections belong to a class. *(DB FKs + trigger)*

## Student lifecycle

- `scholar_number` is continuous: next = `max(numeric scholar_number) + 1`. *(DB `next_scholar_number()`)*
- Admission requires the mandatory fields collected by the admission form; the
  submit button stays disabled until they are valid. *(UI)*
- Section is optional when the selected class has no sections; roll number is
  optional at admission. *(UI)*
- A section must belong to the selected class. *(DB trigger)*
- Student statuses used by the app: **Active, Left, Passed Out, Inactive**
  (the enum also contains `Promoted`/`Transferred` used by promotion). Marking a
  student Left captures `date_of_leaving` and `reason_for_leaving`. *(UI)*
- Historical statuses were deliberately **not** migrated.
- One `student_academic_records` row per student per session; the promotion
  chain is tracked by `promoted_from_record_id`.

## Admission ↔ Fee structure (hard blocker)

- Admission goes through `admit_student_with_fee_structure()` in a single
  transaction: create student → create academic record → link fee structure →
  generate the fee schedule.
- The function selects the **Active + Complete** fee structure matching the
  session and class:
  - 0 matches → admission is blocked with a message to complete a structure.
  - more than 1 match → blocked, duplicate must be resolved.
- "Complete" = the structure has at least one item with amount > 0 **and** every
  active mandatory fee head is configured with amount > 0.
  *(DB `is_fee_structure_complete()`)*
- Any `Active` academic record must reference an active, complete structure that
  matches its class and session. *(DB trigger)*
- Existing records missing a structure can be repaired with
  `link_academic_record_fee_structure()` (admin / super admin only).

## Fee heads and structures

- Fee heads are **global**; fee structures are scoped to session + class;
  each academic record links to exactly one structure.
- A fee head defines: frequency, applicable months, applicability,
  `auto_generate`, `charge_trigger` (Automatic/Manual), mandatory, active.
- Structure items may override frequency/months/applicability per structure.
- A structure shows **Draft** until it is complete, then **Complete**; it can be
  locked to prevent further edits.
- The fee head formerly named "School Monthly Maintenance Fee" is
  **School Management Fee (SMF)**.

## Fee schedule generation

`generate_student_fee_schedule(record_id)` — idempotent, safe to re-run
(unique key `(academic_record_id, fee_head_id, period_label)` + `ON CONFLICT DO NOTHING`):

- Opening balance > 0 produces a single `Opening Balance` row (`sort_key 0000-OPENING`).
- Heads with `auto_generate = false` or `charge_trigger = 'Manual'` are skipped.
- Applicability filter: `Optional` skipped; `NewAdmission` only for records with
  no `promoted_from_record_id`; `Existing` only for promoted records.
- **Monthly/Quarterly:** one row per applicable month; **May and June are never
  generated** (tuition runs July→April). The year rolls over when the month is
  before the session start month.
- **Annual / One Time:** a single row labelled with the fee head name.
- Chronological `sort_key` is `YYYY-MM-<sort_order>`.

## Fee collection & allocation

Allocation priority (`priorityRank` in `src/lib/fees-helpers.ts`):

1. Opening balance
2. Admission fee (only if still outstanding — i.e. new admissions)
3. Activities fee
4. Monthly recurring (Tuition, SMF …) in chronological `sort_key` order
5. Other one-time/annual charges by fee head `sort_order`, then name
6. Optional fees

Rules:

- Three modes: **Quick Collect**, **Manual Allocation**, **Opening Balance Only**;
  the default comes from `fee_settings.default_collection_mode`.
- **Partial payments are not allowed.** Quick Collect and Opening Balance Only
  require the exact outstanding amount; Manual Allocation requires the selected
  rows to be settled in full. Violations show an inline error banner. *(UI)*
- Outstanding of a row = `due_amount − concession_amount − paid_amount`.
- `paid_amount` and `status` on the schedule are recomputed by triggers from
  non-void allocations only — never written by the client.
- Schedule row status: `Waived` when due − concession ≤ 0, `Paid` when fully
  covered, `Partial` when partly covered, otherwise `Pending`.

## Receipts

- Receipt numbers come from `next_receipt_number()` (a sequence).
- Payments are **immutable**: `DELETE` is denied. Corrections are
  **void and re-post** only.
- Void requires a mandatory reason and is restricted to admin / super admin;
  it records `voided_by`/`voided_at` and reverses the ledger via trigger. *(UI + DB)*
- Receipt numbers are clickable everywhere they appear and link to the receipt
  detail screen; print count and last printed timestamp are tracked.

## Concessions

- Recorded per student + session, optionally per fee head, as an amount or a
  percentage, with an approver and approval date.
- Approval is limited to admin / principal (`canApproveConcession`). *(UI)*
- All concession changes are written to the activity log.

## Opening balances

- The single `student_academic_records.opening_balance` remains the value that
  drives the ledger; `opening_balance_details` stores the itemised breakup
  (previous session, fee head, amount, remarks, source).
- Breakup rows can be entered manually or bulk-imported from Excel (multiple
  rows per scholar number combine into the single opening balance).
- The Student Ledger exposes a "View Breakup" dialog.

## Promotion

- Promotion moves a cohort from the source session/class to a chronologically
  later destination session; each student is Promoted, Retained or Excluded.
- A preview is shown before commit; the commit runs as one transaction
  (`bulk_promote_students`), creating new academic records, linking the fee
  structure and generating the schedule.
- Roll numbers in affected classes are regenerated **alphabetically by name**
  (tie-break: scholar number). *(DB `regenerate_class_roll_numbers`, admin/
  super_admin/principal only)*

## Examinations

- Exam masters may be managed by admin, super_admin or principal
  (`can_manage_exam_masters`).
- Grade bands within a scale may not overlap. *(DB trigger)*
- Patterns are versioned: `version_exam_pattern()` creates the next version and
  deactivates the previous one; `clone_exam_pattern()` copies a pattern into
  another session as version 1.
- A locked pattern cannot be edited (name, version, session, grade scale,
  parent) or deleted, and its terms/classes cannot change. *(DB trigger)*

## Teachers

- `employee_code` is auto-generated as `NKS-0001`, `NKS-0002`, … and is unique.
- Documents are stored in the private `teacher-documents` bucket and read only
  through signed URLs; account numbers are masked in the UI.

## Audit logging

- `logActivity()` never throws — a logging failure must never block the primary
  operation.
- `activity_log` is append-only (UPDATE/DELETE denied by policy).
- Display strings are derived by `formatActivityDetails()`; the raw JSON payload
  is preserved in the database.

## Validation rules summary (UI)

- Submit buttons stay disabled until required data is valid, rather than failing
  after submission.
- Excel imports validate every row and finish with a summary of created,
  skipped and failed rows with reasons.
- Amounts are formatted with `formatINR()` (₹, en-IN, 2 decimals); receipts also
  render the amount in words via `amountInWords()`.

## User onboarding (invitation-only)

- Public sign-up is **disabled** in Auth configuration; `/auth` renders sign-in only.
- Super Admins invite staff from **Settings → Users → Invite user**. The account
  is provisioned immediately with a one-time temporary password shown once.
- `user_invitations` records email, roles, inviter and expiry. The
  `handle_new_user()` trigger grants the invited roles on first sign-in.
- Pending invitations can be revoked; expired and accepted invitations are kept
  for audit.
- The first-ever admin is still bootstrapped via `claim_first_admin()`.

## Server-side financial validation

UI validation is now mirrored in the database, so no client path can bypass it:

- Payment amounts must be positive.
- `receipt_number` and `amount` are immutable after insert — corrections are
  void-and-repost only.
- An allocation can never exceed the outstanding balance of its schedule row,
  and the sum of allocations can never exceed the receipt total (0.01 tolerance
  for rounding).
