# Security

Security model of the Nandan Kids ERP as implemented in v1.0.0. Everything below
is enforced today; nothing here is aspirational.

## Threat model in one line

A small number of trusted school staff share a browser-facing app that talks
directly to Postgres. Therefore **the database is the security boundary**, not
the UI. Every UI check has a matching RLS policy, constraint, trigger or
`SECURITY DEFINER` function.

## Authentication

- Supabase Auth, email + password. `/auth` renders **sign-in only**.
- **Public sign-up is disabled** in the Auth configuration.
- `_authenticated/route.tsx` runs with `ssr: false` and a `beforeLoad` that calls
  `supabase.auth.getUser()`, redirecting to `/auth` without a session.
- `/auth` redirects an existing session to `/dashboard` and subscribes to
  `onAuthStateChange`.
- Sessions are managed by the Supabase JS client; the app never stores tokens by
  hand and no service-role key exists in client code.

## Invitation-only onboarding

1. A Super Admin opens **Settings → Users → Invite user**, supplies an email,
   full name and one or more roles.
2. The `inviteUser` server function (`src/lib/invitations.functions.ts`) runs on
   the server, verifies the caller, creates the account through the Supabase
   Admin API with a one-time temporary password and records the invitation.
3. `user_invitations` stores `email`, `roles`, `invited_by`, `expires_at`,
   `accepted_at`, `accepted_user_id`, `revoked_at`.
4. `handle_new_user()` (trigger on `auth.users`) creates the `profiles` row and
   grants the invited roles from the matching, unexpired, unrevoked invitation.
5. Pending invitations can be revoked. Accepted and expired invitations are kept
   for audit.

The very first account bootstraps itself with `claim_first_admin()`, which
refuses once any `super_admin` exists.

## Authorization

- Roles live **only** in `public.user_roles` (`app_role` enum). Storing a role on
  `profiles` or `students` is forbidden — it would allow privilege escalation
  through a normal profile update.
- `public.has_role(uuid, app_role)` is `SECURITY DEFINER`, `STABLE`, with
  `search_path = public`. RLS policies call it instead of selecting from
  `user_roles` directly, which avoids recursive policy evaluation.
- `can_manage_exam_masters(uuid)` wraps the exam-master role set.
- The UI derives every capability from `buildPermissions()` in
  `src/lib/permissions.ts` (via `useUserRoles()`). See
  [PERMISSIONS.md](./PERMISSIONS.md).

## Row Level Security

- RLS is enabled on **every** table in `public`, with explicit `GRANT`s — the
  Data API grants nothing by default.
- Reads follow least privilege. Sensitive tables no longer use `USING (true)`:

| Table group                                                                                           | Readable by                                                 |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `students`, `student_academic_records`, `student_fee_schedule`                                        | `super_admin`, `admin`, `reception`, `principal`, `teacher` |
| `admissions`, `fee_payments`, `fee_payment_allocations`, `fee_concessions`, `opening_balance_details` | `super_admin`, `admin`, `reception`, `principal`            |
| Institutional config (sessions, classes, sections, houses, fee heads/structures, school profile)      | any authenticated staff account                             |

- Writes are restricted per module by `has_role()`.
- Hard restrictions:
  - `teachers` / `teacher_documents` — Super Admin only.
  - `activity_log` — insert + role-scoped read; UPDATE and DELETE denied.
  - `fee_payments` — DELETE denied.
  - `profiles` — DELETE denied.
  - `migration_batches` / `migration_batch_items` — Admin and Super Admin only;
    DELETE denied on batches, UPDATE denied on items.
- `scripts/verify-migrations.mjs` fails CI if a new migration creates a
  `public` table without `GRANT`s, RLS and policies.

## Database function privileges

- `EXECUTE` on every `SECURITY DEFINER` function in `public` is revoked from
  `PUBLIC` and from `anon`.
- Only the 17 RPCs the app actually calls are granted to `authenticated`
  (`has_role`, `admit_student_with_fee_structure`, `bulk_promote_students`,
  `generate_student_fee_schedule`, `go_live_validation`,
  `rollback_migration_batch`, `invite_user`, …). Each one re-checks
  `auth.uid()` and the caller's roles inside the function body.

## Financial integrity (database-enforced)

| Guard                                                    | Enforcement                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Positive payment amounts                                 | `validate_fee_payment` trigger                                                         |
| `receipt_number` and `amount` immutable after insert     | `validate_fee_payment` trigger                                                         |
| Allocation ≤ outstanding of the schedule row             | `validate_fee_payment_allocation` trigger (0.01 rounding tolerance)                    |
| Σ allocations ≤ receipt total                            | `validate_fee_payment_allocation` trigger                                              |
| `paid_amount` / `status` never client-written            | `recompute_schedule_paid` trigger                                                      |
| Void reverses the ledger atomically                      | `recompute_on_payment_void` trigger                                                    |
| Corrections only by void-and-repost                      | `DELETE` denied on `fee_payments`                                                      |
| Exactly one Active + Complete fee structure at admission | `admit_student_with_fee_structure()` + `validate_active_academic_record_fee_structure` |
| One Active academic session                              | partial unique index + `validate_academic_session_transition`                          |

## Storage policies

| Bucket              | Public | Contents                                      | Access                                                                                                                                                     |
| ------------------- | ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `students`          | No     | `photos/<scholar>/…`, `documents/<scholar>/…` | Authenticated staff via helpers in `students-helpers.ts`; UPDATE/DELETE additionally require the scholar number in the path to match a real student record |
| `teacher-documents` | No     | `<employee_code>/…`                           | Super Admin only                                                                                                                                           |

Both buckets are private. Files are **never** linked directly — the UI requests a
short-lived signed URL each time. Do not make a bucket public.

## Activity logging

- Every user-triggered create/update/delete calls `logActivity()`
  (`src/lib/activity.ts`), which is fire-and-forget and **never throws**, so an
  audit failure cannot block the primary operation.
- `activity_log` rows carry `user_id`, `module`, `action`, `entity_type`,
  `entity_id` and a `details` JSON payload; `formatActivityDetails()` renders
  human-readable summaries while the raw payload is preserved.
- The log is append-only and readable per role (`canViewActivityLog`:
  admin, principal, super admin).

## Secrets

- The browser only ever receives `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable by design).
- Privileged keys are read from `process.env` **inside** server-function handlers
  only. Never import a server-only module into a component.
- `.env` and the generated Supabase integration files are managed by the
  platform; do not hand-edit them or commit additional secrets.

## Reporting a vulnerability

Report suspected issues to the school's IT administrator / project owner
privately, with reproduction steps. Do not open a public issue and do not test
against production data.
