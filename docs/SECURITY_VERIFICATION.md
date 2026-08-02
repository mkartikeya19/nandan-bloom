# Security Verification — v1.0.0

This report separates what is **verified from the repository and the live
schema** from what **must be checked manually in production settings**. Nothing
here is inferred.

Verification date: **2 August 2026**. Verified against the current repository
state and a live read of the database catalogue.

---

## 1. Verified from code / schema

| # | Control | Evidence | Status |
| --- | --- | --- | --- |
| 1 | RLS enabled on every `public` table | Live query of `pg_tables` / `pg_policies`: 32 of 32 public tables have `rowsecurity = true`, each with ≥1 policy | **Verified** |
| 2 | Grants + RLS + policies required for new tables | `scripts/verify-migrations.mjs`; run passes for all 27 migrations | **Verified** |
| 3 | Roles isolated from user data | Roles exist only in `public.user_roles`; `profiles` and `students` carry no role column | **Verified** |
| 4 | Role checks are `SECURITY DEFINER` and non-recursive | `has_role()`, `can_manage_exam_masters()` with `SET search_path = public` | **Verified** |
| 5 | Privilege-escalation path closed | `claim_first_admin()` returns `false` once any `super_admin` exists, and requires `auth.uid()` | **Verified** |
| 6 | Invitation-only onboarding | `user_invitations` + `invite_user()` (super_admin only) + `handle_new_user` trigger + `inviteUser` server function guarded by `requireSupabaseAuth` and a re-check of `user_roles` | **Verified** |
| 7 | No sign-up surface in the app | `src/routes/auth.tsx` exposes sign-in only | **Verified** |
| 8 | Financial integrity enforced server-side | `validate_fee_payment` (positive amount, immutable receipt number and amount, no un-voiding) and `validate_fee_payment_allocation` (allocation ≤ receipt total, allocation ≤ outstanding, no allocation to voided receipts) | **Verified** |
| 9 | Ledger recomputation on void | `recompute_on_payment_void`, `recompute_schedule_paid` | **Verified** |
| 10 | Session integrity | Partial unique index for a single Active session + `validate_academic_session_transition` | **Verified** |
| 11 | Admission integrity | `admit_student_with_fee_structure()` blocks admission unless exactly one Active + Complete fee structure matches the session and class | **Verified** |
| 12 | Teacher data restricted to Super Admin | RLS on `teachers` / `teacher_documents`, `teacher-documents` storage policies, route guard and sidebar condition | **Verified** |
| 13 | Storage buckets private with role-scoped policies | `students` and `teacher-documents` policies in migrations `…a99e80d8…` and `…96a14183…`; files served via signed URLs | **Verified** (policies) |
| 14 | Append-only audit trail | `activity_log` with insert-only policy; `logActivity()` never throws | **Verified** |
| 15 | Secrets not in client code | Only `VITE_*` publishable values reach the browser; `process.env` reads occur inside server-function handlers; `supabaseAdmin` is imported dynamically inside a handler after authorisation | **Verified** |
| 16 | Type safety | `bun run typecheck` clean | **Verified** |

## 2. Requires manual verification in production

Do not treat any of these as verified until an operator records a result.

| # | Item | Where to check | Status |
| --- | --- | --- | --- |
| 1 | Public sign-up disabled at the auth provider | Backend auth settings | **Pending** |
| 2 | Anonymous sign-in disabled | Backend auth settings | **Pending** |
| 3 | Leaked-password (HIBP) protection enabled | Backend auth settings | **Pending** |
| 4 | Provider minimum password length | Backend auth settings | **Pending** |
| 5 | Both storage buckets actually private in production | Backend storage settings | **Pending** |
| 6 | All 27 migrations applied to the production database | Backend migration history | **Pending** |
| 7 | Backup / point-in-time recovery window | Platform settings | **Pending** |
| 8 | Per-role behaviour observed in the running app | [ROLE_VERIFICATION.md](./ROLE_VERIFICATION.md) | **Pending** |
| 9 | Automated security scan on the release build | Platform security scan | **Pending** |

## 3. Known gaps (accepted for v1.0.0)

| Gap | Impact | Mitigation |
| --- | --- | --- |
| No forced password change at first login | A temporary password may remain in use | Issue invitations individually; deliver out of band; see [PRODUCTION_CONFIGURATION.md](./PRODUCTION_CONFIGURATION.md#5-password-policy) |
| No self-service password change or reset | Resets require a platform administrator | Documented operational procedure |
| No SMTP / email delivery | Invitations and resets are manual | By design in v1.0.0 |
| Lint gate failing (formatting only) | No security impact; blocks a green CI run | Fix pending approval — see [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md#open-blocker--lint-gate) |

## 4. Conclusion

Application-layer and database-layer security controls are implemented and
verifiable in code. **Production provider settings and per-role runtime
behaviour have not been verified.** Until section 2 is completed and recorded,
the release remains *Release Candidate – Operational Verification Pending*.
