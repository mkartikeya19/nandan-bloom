# Database

Postgres (Supabase). Schema `public`. Every table has RLS enabled and explicit
`GRANT`s. Migrations in `supabase/migrations/` are the source of truth; the
TypeScript types in `src/integrations/supabase/types.ts` are generated from the
live schema and must not be hand-edited.

Conventions used everywhere:

- `id uuid primary key default gen_random_uuid()`
- `created_at` / `updated_at timestamptz not null default now()`
- `updated_at` maintained by the `update_updated_at_column()` trigger
- `citext` for case-insensitive unique names (sessions, classes, sections,
  houses, fee heads)

## Enums

| Enum                      | Values                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `app_role`                | admin, teacher, staff, super_admin, reception, principal                             |
| `student_admission_type`  | New Admission, Existing Student Migration, Re-admission                              |
| `student_academic_status` | Active, Promoted, Left, Passed Out, Transferred, Inactive                            |
| `fee_frequency`           | Monthly, Quarterly, Annual, One Time, Optional                                       |
| `fee_applicability`       | All, NewAdmission, Existing, Optional                                                |
| `fee_schedule_status`     | Pending, Partial, Paid, Waived                                                       |
| `fee_payment_mode`        | Cash, Cheque, UPI, NEFT, RTGS, IMPS, Bank Transfer, Debit Card, Credit Card, QR Code |

## Identity & access

### `profiles`

`id` (FK → `auth.users.id`), `full_name`, `email`, `phone`, `avatar_url`,
timestamps. Populated by the `handle_new_user()` trigger on signup. Deletes are
denied by policy.

### `user_roles`

`id`, `user_id` (FK → `auth.users.id`), `role app_role`, `created_at`.
Unique on `(user_id, role)`. Read by the `has_role()` security-definer function.
**Roles must never be stored on `profiles` or `students`.**

### `activity_log`

`id`, `user_id`, `module`, `action`, `entity_type`, `entity_id`, `details jsonb`,
`created_at`. Append-only: UPDATE and DELETE are denied by policy.

## School masters

### `school_profile`

Single row: `name`, address fields, `phone`, `email`, `website`, `udise_code`,
`affiliation_board`, `affiliation_number`, `principal_name`, `established_year`,
`logo_url`. The school name column is `name` (not `school_name`).

### `academic_sessions`

`name citext`, `start_date`, `end_date`, `is_active`, `status text`
(`Draft` | `Active` | `Closed`), `closed_at`, `closed_by`.
`is_active` is derived from `status` by the
`validate_academic_session_transition()` trigger. A partial unique index allows
only one `Active` session at a time.

### `school_classes`

`session_id` (FK → `academic_sessions`), `name citext`, `order_index`.
Classes are scoped to a session.

### `school_sections`

`class_id` (FK → `school_classes`), `name citext`.

### `houses`

`name citext`, `color`, `description`.

## Students

### `students`

Personal master record, one per human, independent of session.
Key columns: `scholar_number` (unique, numeric-continuous), `admission_number`,
`full_name`, `gender`, `date_of_birth`, `date_of_admission`,
`admission_type student_admission_type`, government IDs (`aadhaar_number`,
`apaar_id`, `pen_id`, `samagra_id`), `nationality`, `religion`, `category`,
`caste`, `blood_group`, `mother_tongue`, parent/guardian blocks
(`father_*`, `mother_*`, `guardian_*`), emergency contact, address block,
document paths (`photo_url`, `birth_certificate_url`, `aadhaar_copy_url`,
`transfer_certificate_url`, `other_documents jsonb`), `status`,
`date_of_leaving`, `reason_for_leaving`.

### `student_academic_records`

One row per student **per academic session** — the enrolment record.
`student_id`, `academic_session_id`, `class_id`, `section_id`, `house_id`,
`roll_number`, `status student_academic_status`, `joined_on`,
`fee_structure_id`, `opening_balance`, `promoted_from_record_id` (self FK, the
promotion chain).
Triggers: `validate_section_belongs_to_class()` and
`validate_active_academic_record_fee_structure()`.

## Fees

### `fee_heads` (global)

`name citext`, `code`, `description`, `is_mandatory`, `default_amount`,
`default_frequency fee_frequency`, `default_applicable_months int[]`,
`default_applicability fee_applicability`, `auto_generate boolean`,
`charge_trigger text` (`Automatic` | `Manual`), `is_active`, `sort_order`.

### `fee_structures`

Scoped to `academic_session_id` + `class_id`, plus `is_active`, `name`, and
legacy denormalised totals (`tuition_fee`, `admission_fee`, `exam_fee`,
`transport_fee`, `other_fee`, `total_fee`, `class_name`, `academic_year`) kept
for backwards compatibility — the authoritative amounts are in
`fee_structure_items`.

### `fee_structure_items`

`fee_structure_id`, `fee_head_id`, `amount`, `frequency`, `applicable_months`,
`applicability`, `is_optional`, `sort_order`.

### `student_fee_schedule` (the ledger)

Generated per academic record: `student_id`, `academic_record_id`,
`academic_session_id`, `fee_structure_item_id`, `fee_head_id`, `period_label`,
`period_month`, `period_year`, `due_amount`, `concession_amount`,
`paid_amount`, `status fee_schedule_status`, `due_date`, `is_opening_balance`,
`display_order`, `sort_key` (`YYYY-MM-…`, used for chronological ordering).
Unique on `(academic_record_id, fee_head_id, period_label)` — this is what makes
schedule generation idempotent.

### `fee_payments`

`student_id`, `receipt_number` (from `next_receipt_number()`), `amount`,
`sub_total`, `concession_total`, `payment_mode`, `payment_date`,
`academic_session_id`, `academic_record_id`, `academic_year`, `term`,
`transaction_reference`, `collected_by`, `remarks`/`notes`, `status`,
`is_void`, `void_reason`, `voided_by`, `voided_at`, `receipt_print_count`,
`last_printed_at`. DELETE is denied — corrections are void-and-repost.

### `fee_payment_allocations`

`fee_payment_id`, `student_fee_schedule_id`, `amount`. Triggers
`recompute_schedule_paid()` (insert/update/delete) and, on the payment,
`recompute_on_payment_void()` keep `student_fee_schedule.paid_amount`/`status`
correct.

### `fee_concessions`

`student_id`, `academic_session_id`, `fee_head_id` (nullable = all heads),
`concession_type`, `reason`, `amount`, `percentage`, `approved_by`,
`approved_on`.

### `opening_balance_details`

Detailed breakup behind `student_academic_records.opening_balance`:
`student_id`, `academic_record_id`, `academic_session_id`, `session_label`,
`fee_head_id`, `fee_head_label`, `amount`, `remarks`, `source`
(manual/import), `created_by`.

### `fee_settings`

Single row: `late_fee_enabled`, `late_fee_amount`, `late_fee_grace_days`,
`default_collection_mode`.

## Examinations

| Table                           | Purpose                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `exam_subjects`                 | Global subject master (`name`, `code`, `is_active`, `sort_order`)                                                                             |
| `exam_class_subjects`           | Maps a subject to a class (`class_id`, `subject_id`, `is_active`, `sort_order`)                                                               |
| `exam_class_subject_components` | Assessment components per class-subject (`name`, `max_marks`, `is_practical`, `sort_order`)                                                   |
| `exam_grade_scales`             | Named grade scale (`is_default`, `is_active`)                                                                                                 |
| `exam_grade_bands`              | Bands per scale (`min_percent`, `max_percent`, `grade`, `remark`); trigger `validate_grade_band_no_overlap()`                                 |
| `exam_patterns`                 | Versioned pattern per session (`name`, `version`, `parent_pattern_id`, `grade_scale_id`, `is_active`, `is_locked`, `locked_at`, `created_by`) |
| `exam_pattern_terms`            | Terms in a pattern (`name`, `weightage_percent`, `include_in_final`, `sort_order`)                                                            |
| `exam_pattern_classes`          | Classes a pattern applies to                                                                                                                  |

Trigger `block_locked_pattern_write()` guards `exam_patterns` and its child
tables once a pattern is locked.

## Teachers

### `teachers`

`employee_code` (unique, `NKS-0000` format), `user_id` (optional link to
`auth.users`), `full_name`, `email`, `phone`, `gender`, `date_of_birth`,
`date_of_joining`, `qualification`, `subject_specialization`, `designation`,
`address`, `aadhaar_number`, `pan_number`, bank block (`bank_name`,
`account_holder_name`, `account_number`, `ifsc_code`), `monthly_salary`,
`salary_effective_from`, `total_experience_years`, `previous_school`,
`status`, `is_archived`. Single RLS policy — Super Admin only.

### `teacher_documents`

`teacher_id`, `doc_type`, `label`, `file_path` (in the private
`teacher-documents` bucket), `uploaded_by`.

## Other

- `attendance` — `student_id`, `class_id`, `date`, `status`, `remarks`,
  `marked_by`. Schema exists; the UI is a placeholder.
- `admissions` — legacy admission-enquiry table (`application_number`,
  applicant details, `status`, `applied_on`).

## Sequences

- `public.teacher_employee_seq` → `next_employee_code()` → `NKS-0001`…
- `public.fee_receipt_seq` → `next_receipt_number()`

## Functions (RPCs)

See [API.md](./API.md) for signatures and behaviour. Summary:

| Function                                                                                            | Kind                              |
| --------------------------------------------------------------------------------------------------- | --------------------------------- |
| `has_role`, `can_manage_exam_masters`                                                               | role checks (security definer)    |
| `claim_first_admin`                                                                                 | bootstrap first super admin       |
| `next_scholar_number`, `next_employee_code`, `next_receipt_number`                                  | identifier generation             |
| `is_fee_structure_complete`, `find_complete_fee_structure`                                          | fee structure validation          |
| `generate_student_fee_schedule`                                                                     | ledger generation (idempotent)    |
| `admit_student_with_fee_structure`                                                                  | single-transaction admission      |
| `link_academic_record_fee_structure`                                                                | repair utility for orphan records |
| `bulk_promote_students`, `regenerate_roll_numbers_after_promotion`, `regenerate_class_roll_numbers` | promotion                         |
| `clone_exam_pattern`, `version_exam_pattern`                                                        | exam pattern lifecycle            |

## Triggers

| Trigger function                                | Attached to                                                   | Effect                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `update_updated_at_column`                      | most tables                                                   | maintains `updated_at`                                         |
| `handle_new_user`                               | `auth.users` (managed)                                        | creates a `profiles` row                                       |
| `validate_academic_session_transition`          | `academic_sessions`                                           | syncs `is_active`, blocks illegal status transitions           |
| `validate_section_belongs_to_class`             | `student_academic_records`                                    | section must belong to the class                               |
| `validate_active_academic_record_fee_structure` | `student_academic_records`                                    | Active records need a matching, active, complete fee structure |
| `recompute_schedule_paid`                       | `fee_payment_allocations`                                     | recomputes `paid_amount` + `status`                            |
| `recompute_on_payment_void`                     | `fee_payments`                                                | reverses/reapplies the ledger on void toggle                   |
| `validate_grade_band_no_overlap`                | `exam_grade_bands`                                            | prevents overlapping bands                                     |
| `block_locked_pattern_write`                    | `exam_patterns`, `exam_pattern_terms`, `exam_pattern_classes` | protects locked patterns                                       |

## Migrations

`supabase/migrations/*.sql`, timestamp-prefixed and applied in order. They were
built incrementally: core schema → fees engine → activity log & session states →
fee head business rules → fee structure completeness/admission automation →
promotion hardening & roll numbers → collection modes & exam masters → session
integrity → teachers → opening balance details. Never edit an applied migration;
add a new one.

## Storage buckets

| Bucket              | Public | Contents                                      |
| ------------------- | ------ | --------------------------------------------- |
| `students`          | No     | `photos/<scholar>/…`, `documents/<scholar>/…` |
| `teacher-documents` | No     | `<employee_code>/…`                           |

Files are always served through short-lived signed URLs.
