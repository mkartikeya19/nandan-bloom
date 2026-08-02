# API Reference

There is no bespoke HTTP API. The client calls Postgres through `supabase-js`
(PostgREST + RPC) and Supabase Storage. This file documents the callable
surface: database functions, storage operations and the TypeScript helpers that
wrap them.

## Client

```ts
import { supabase } from "@/integrations/supabase/client"; // auto-generated, do not edit
```

Auth-token attachment for server functions is registered in `src/start.ts` via
`attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts`).

---

## Database functions (RPC)

Call with `supabase.rpc("<name>", { …args })`. All are `SECURITY DEFINER` unless
noted, and re-check the caller's role internally.

### Role & bootstrap

| Function                  | Args                            | Returns   | Notes                                                                                |
| ------------------------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `has_role`                | `_user_id uuid, _role app_role` | `boolean` | stable; used inside RLS policies                                                     |
| `can_manage_exam_masters` | `_uid uuid`                     | `boolean` | admin, super_admin or principal                                                      |
| `claim_first_admin`       | —                               | `boolean` | grants admin+super_admin to the caller when no super admin exists; `false` otherwise |

### Identifier generation

| Function                | Returns | Notes                                                      |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `next_scholar_number()` | `text`  | `max(numeric scholar_number) + 1`                          |
| `next_employee_code()`  | `text`  | `NKS-0001` … from `teacher_employee_seq`, skips collisions |
| `next_receipt_number()` | `text`  | from `fee_receipt_seq`                                     |

### Fee structure

| Function                      | Args                                        | Returns                                     | Notes                                                               |
| ----------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `is_fee_structure_complete`   | `_structure_id uuid`                        | `boolean`                                   | at least one priced item **and** every active mandatory head priced |
| `find_complete_fee_structure` | `_academic_session_id uuid, _class_id uuid` | `TABLE(structure_id uuid, match_count int)` | `match_count` counts all active structures for the pair             |

### Fees ledger

| Function                        | Args              | Returns               | Notes                                                                                |
| ------------------------------- | ----------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `generate_student_fee_schedule` | `_record_id uuid` | `int` (rows inserted) | idempotent; skips May/June, manual and non-auto heads, applies applicability filters |

### Admission & repair

| Function                             | Args                                              | Returns                                                                       |
| ------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `admit_student_with_fee_structure`   | `_student_payload jsonb, _academic_payload jsonb` | `jsonb { student_id, academic_record_id, fee_structure_id, generated_count }` |
| `link_academic_record_fee_structure` | `_record_id uuid`                                 | `jsonb { academic_record_id, fee_structure_id, generated_count }`             |

`_student_payload` keys mirror `students` columns (`scholar_number`,
`full_name`, `gender`, `date_of_birth`, `date_of_admission`, `admission_type`,
government IDs, parent/guardian blocks, address block…). `_academic_payload`
keys: `academic_session_id`, `class_id`, `section_id`, `roll_number`,
`house_id`, `joined_on`, `status`. Empty strings are normalised to `NULL` and
enum values are cast explicitly. Callers must be admin, super_admin or reception.

### Promotion

| Function                                  | Args                                                                                                                                                                                                                           | Returns                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `bulk_promote_students`                   | `_payload jsonb` (`{ items: [{ student_id, new_session_id, new_class_id, new_section_id, new_house_id, new_roll_number, joined_on, action: "promote"\|"retain", fee_structure_id, generate_schedule, previous_record_id }] }`) | `jsonb { promoted, retained, schedules_created }`             |
| `regenerate_class_roll_numbers`           | `_academic_session_id uuid, _class_id uuid`                                                                                                                                                                                    | `int` — alphabetical renumbering; admin/super_admin/principal |
| `regenerate_roll_numbers_after_promotion` | `_payload jsonb` (same shape)                                                                                                                                                                                                  | `int`                                                         |

### Examinations

| Function               | Args                                                    | Returns                                       |
| ---------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `clone_exam_pattern`   | `_source_id uuid, _new_session_id uuid, _new_name text` | `uuid` — new pattern (version 1)              |
| `version_exam_pattern` | `_source_id uuid`                                       | `uuid` — next version; deactivates the source |

### Trigger functions

`update_updated_at_column`, `handle_new_user`,
`validate_academic_session_transition`, `validate_section_belongs_to_class`,
`validate_active_academic_record_fee_structure`, `recompute_schedule_paid`,
`recompute_on_payment_void`, `validate_grade_band_no_overlap`,
`block_locked_pattern_write`. Not callable directly — see DATABASE.md.

---

## Storage APIs

Both buckets are private; reads use `createSignedUrl`.

| Bucket              | Helper                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `students`          | `uploadStudentFile(scholarNumber, "photos" \| "documents", file)` → path; `getSignedStudentUrl(path, expiresIn = 3600)` |
| `teacher-documents` | `uploadTeacherFile(employeeCode, file)` → path; `getSignedTeacherUrl(path, expiresIn = 3600)`                           |

Paths: `photos/<scholar>/<ts>_<name>`, `documents/<scholar>/<ts>_<name>`,
`<employee_code>/<ts>_<name>`. Filenames are sanitised to `[\w.\-]`.

---

## Helper utilities

### `src/lib/fees-helpers.ts`

- Constants: `FEE_FREQUENCIES`, `FEE_APPLICABILITIES`, `FEE_APPLICABILITY_LABELS`,
  `PAYMENT_MODES`, `SCHEDULE_STATUSES`, `MONTH_NAMES`,
  `DEFAULT_TUITION_MONTHS` (Jul–Apr), `BLOCKED_TUITION_MONTHS` (May, June).
- `formatINR(n)` — ₹ en-IN with 2 decimals.
- `amountInWords(n)` — Indian numbering (crore/lakh/thousand) → "… Rupees Only".
- `priorityRank(row)` / `comparePriority(a, b)` — allocation ordering.
- `allocatePayment(amount, rows)` → `AllocationDraft[]` — greedy allocation in
  priority order, rounded to paise.
- `outstandingOf(row)` — `due − concession − paid`, floored at 0.
- `generateStudentSchedule(recordId)` — RPC wrapper.
- `nextReceiptNumber()` — RPC wrapper.
- Types: `ScheduleRow`, `AllocationDraft`, `FeeFrequency`, `FeeApplicability`,
  `PaymentMode`, `ScheduleStatus`.

### `src/lib/students-helpers.ts`

- `STUDENT_STATUS_VALUES`, `ADMISSION_TYPE_VALUES`.
- `uploadStudentFile`, `getSignedStudentUrl`, `fetchNextScholarNumber`.
- `IMPORT_COLUMNS` — the canonical Excel header row.
- `downloadImportTemplate()` — writes `student-import-template.xlsx`.
- `parseWorkbook(file)` → `RawRow[]` (first sheet, `defval: ""`).
- `cleanStr(v)` — trims, returns `null` for blanks.

### `src/lib/teachers-helpers.ts`

- `TEACHER_STATUS_VALUES`, `TEACHER_DOC_TYPES`, `TeacherDocumentRow`.
- `uploadTeacherFile`, `getSignedTeacherUrl`, `fetchNextEmployeeCode`.
- `formatSalary(v)` — INR, no decimals, `—` when null.
- `maskAccount(v)` — shows only the last 4 characters.

### `src/lib/activity.ts`

- `logActivity({ module, action, entityType, entityId, details })` — inserts into
  `activity_log` with the current user; **never throws**.
- `ActivityModule` union: Students, Admissions, Fees, Attendance, Examinations,
  Users, Sessions, Settings, Promotion, Teachers.

### `src/lib/activity-format.ts`

- `formatActivityDetails(module, action, details)` → human-readable summary for
  the Activity Center. Display-only; raw JSON stays in the database.

### `src/lib/utils.ts`

- `cn(...classes)` — `clsx` + `tailwind-merge`.

### `src/hooks/use-user-role.ts`

- `useUserRoles()` → `{ userId, roles, isSuperAdmin, isAdmin, isReception,
isPrincipal, isTeacher, …permission booleans }` (query key
  `["current-user-roles"]`, `staleTime` 60s). See MODULES.md for the matrix.

### Error handling

`src/lib/error-capture.ts`, `src/lib/error-page.ts` and `src/server.ts` convert
SSR failures (including h3-swallowed errors) into a rendered error page.

---

## RC-3.5 additions

### RPCs

- `invite_user(_email text, _roles app_role[], _full_name text) → uuid`
  (`SECURITY DEFINER`, Super Admin only). Upserts a row in `user_invitations`
  and returns the invitation id.

### Triggers (server-side financial validation)

- `validate_fee_payment()` on `fee_payments` — rejects non-positive amounts and
  blocks edits to `receipt_number` / `amount` after insert (void-and-repost only).
- `validate_fee_payment_allocation()` on `fee_payment_allocations` — rejects
  allocations that exceed the schedule row's outstanding balance or the receipt
  total (0.01 rounding tolerance).

### Server functions

- `src/lib/invitations.functions.ts` → `inviteUser({ email, fullName?, roles })`
  (POST, `requireSupabaseAuth`, Super Admin only). Records the invitation and
  provisions the account through the Auth Admin API, returning
  `{ created, tempPassword }`. The temporary password is returned once and never
  stored.

### Permissions service — `src/lib/permissions.ts`

- `APP_ROLES`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS`, `AppRole`.
- `resolvePermissions(roles)` → the single source of truth for every capability
  flag (`canEditStudent`, `canVoidReceipt`, `canManageTeachers`, …).
  `useUserRoles()` is a thin wrapper over it.

### Date service — `src/lib/date.ts`

- `formatDate`, `formatDateTime`, `formatDateInput` — house format `02 Aug 2026`,
  SSR-safe (no locale drift / hydration mismatch).

### Pure logic modules (unit-tested in `src/lib/__tests__/`)

- `src/lib/promotion-helpers.ts` — `resolveNextClass`, `eligibleDestinationSessions`.
- `src/lib/opening-balance.ts` — `groupByScholar`, `validateBreakup`.
- `src/lib/receipts.ts` — void arithmetic and receipt status helpers.

### Service modules (`src/services/`)

`users.service.ts`, `invitations.service.ts`, `fees.service.ts`,
`students.service.ts` — feature-scoped wrappers around Supabase queries. New
data access should go here rather than inline in route components.
