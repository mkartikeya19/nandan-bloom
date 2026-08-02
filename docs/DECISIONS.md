# Architecture Decisions

Each entry records a decision that is expensive to reverse, why it was taken and
what it costs. They describe the v1.0.0 implementation.

## ADR-001 — No custom API layer

**Decision.** The React app talks to Postgres directly through PostgREST /
`supabase-js`. There is no Node/Express service in between.

**Why.** A single-school ERP with a handful of concurrent users does not justify
a second deployable. RLS already provides per-row authorization, and removing the
API layer removes an entire class of "the API forgot to check" bugs.

**Consequences.** Every table must have correct `GRANT`s, RLS and policies —
there is no server-side gate to fall back on. Anything multi-step must be a
`SECURITY DEFINER` function instead of an endpoint.

## ADR-002 — Business logic lives in Postgres

**Decision.** Admission, promotion, schedule generation, roll numbers, receipt
numbering, void reversal and payment validation are database functions and
triggers.

**Why.** They must be atomic and authorization-sensitive. A client-side
implementation can be interrupted halfway (leaving orphaned records — which
happened before this decision) and can be bypassed by any other client.

**Consequences.** Logic is harder to unit-test and requires SQL fluency. Only
pure, presentational rules stay in TypeScript.

## ADR-003 — Roles in a dedicated `user_roles` table

**Decision.** Roles live only in `public.user_roles`, read through the
`SECURITY DEFINER` function `has_role(uuid, app_role)`.

**Why.** A role column on `profiles` is editable by the user through their own
profile update policy — a direct privilege-escalation path. A security-definer
function also avoids recursive RLS evaluation.

**Consequences.** Role reads need a join or the helper function; multiple roles
per user are supported by design.

## ADR-004 — Payments are immutable; corrections are void-and-repost

**Decision.** `DELETE` on `fee_payments` is denied for every role. Receipt number
and amount are immutable after insert. A mistake is voided (with a mandatory
reason) and re-posted.

**Why.** Receipts are financial documents already handed to parents. An audit
trail that can be edited is not an audit trail.

**Consequences.** Void reversal must be trigger-driven so the ledger stays
consistent, and the receipt register accumulates voided rows (shown as such).

## ADR-005 — Full settlement only; no partial payments

**Decision.** Every collection mode requires each targeted schedule row to be
settled in full.

**Why.** The school collects fees in full at the counter. Allowing partials
multiplied reconciliation states and produced ambiguous receipts during UAT.

**Consequences.** Genuine part-payment cases must be modelled as a concession or
handled outside the system. Relaxing this validation is explicitly forbidden.

## ADR-006 — Fee heads are global; structures are session + class scoped

**Decision.** `fee_heads` are school-wide categories carrying the business rules
(frequency, applicable months, applicability, auto-generate, charge trigger).
`fee_structures` price those heads for one session and class. Each academic
record links to exactly one structure.

**Why.** Head semantics ("Tuition is monthly, July → April") do not change per
class; only the amount does. This keeps pricing changes to a single screen and
lets the generator be rule-driven.

**Consequences.** Admission is blocked unless exactly one Active + Complete
structure matches the session and class — deliberately loud rather than silently
admitting an unpriced student.

## ADR-007 — Idempotent schedule generation

**Decision.** `generate_student_fee_schedule` relies on the unique key
`(academic_record_id, fee_head_id, period_label)` and only inserts missing rows.

**Why.** Users re-run it after fixing a structure or an opening balance; it must
never double-charge.

**Consequences.** Removing a head from a structure does not remove already
generated rows — that is a deliberate manual decision.

## ADR-008 — May and June are never billed

**Decision.** The generator excludes months 5 and 6; tuition runs July → April.

**Why.** School policy at Nandan Kids. Encoding it centrally prevents every
structure from re-declaring it.

**Consequences.** Any genuinely 12-month head needs an explicit product decision;
`BLOCKED_TUITION_MONTHS` is a single place to revisit.

## ADR-009 — Opening balance stored twice: total and breakup

**Decision.** `student_academic_records.opening_balance` holds the single amount
the ledger uses; `opening_balance_details` holds the itemised history
(session, head, amount, remarks).

**Why.** Collection logic needs one number; parents and auditors need the
itemisation of pre-migration dues. Splitting them avoided rewriting the
allocation engine.

**Consequences.** The two must be kept consistent — the migration utility writes
both, and the ledger's "View Breakup" reads the detail table.

## ADR-010 — Invitation-only onboarding

**Decision.** Public sign-up is disabled. Super Admins create accounts through a
server function using the Auth Admin API, backed by `user_invitations`.

**Why.** A school ERP has a closed, known user set. Open sign-up plus a
role-claim flow is an unnecessary attack surface.

**Consequences.** There is no email delivery — the temporary password is shown
once and shared out of band. `claim_first_admin()` remains as the bootstrap
path and refuses once a super admin exists.

## ADR-011 — Teachers are Super Admin only

**Decision.** Teacher records, salary, bank details and documents are visible
only to `super_admin`, enforced in the sidebar, the routes and RLS.

**Why.** Confidential HR data in a small school where "admin" is a broad
operational role.

**Consequences.** Future modules that need teacher references (attendance, exams,
payroll) must expose a narrow, non-confidential projection rather than widening
this policy.

## ADR-012 — Private storage buckets with signed URLs

**Decision.** `students` and `teacher-documents` are private; files are read
through short-lived signed URLs requested per view.

**Why.** Student documents (Aadhaar, birth certificates) and HR documents must
not be guessable-URL public objects.

**Consequences.** Every render path must request a URL rather than storing one;
helper functions centralise this.

## ADR-013 — Flat file routes with the `*.index.tsx` convention

**Decision.** A module with children names its landing page `module.index.tsx`.

**Why.** A bare `module.tsx` becomes a layout route and swallows every child
unless it renders `<Outlet />`. This silently broke Students and Fees twice.

**Consequences.** The convention is non-negotiable and documented in
`src/routes/README.md`; `students.tsx`, `fees.tsx`, `fees.collect.tsx` and
`fees.structures.tsx` must never reappear.

## ADR-014 — Append-only activity log that never throws

**Decision.** `activity_log` denies UPDATE and DELETE; `logActivity()` is
fire-and-forget and swallows its own errors.

**Why.** An audit trail must be tamper-evident, and audit failure must never
prevent a fee receipt from being posted.

**Consequences.** Logging gaps are possible under failure and are accepted;
readability comes from `formatActivityDetails()` rather than from stored text.

## ADR-015 — Worker runtime, no Node-only dependencies

**Decision.** The server runs on a Cloudflare Worker; only Worker-compatible,
fully bundled packages may be added.

**Why.** It is the deployment target. Node-only packages fail at runtime, not at
build time — after release.

**Consequences.** PDF/Excel work uses browser-side or WASM-friendly libraries,
and `ssr.external` must never be set in `vite.config.ts`.
