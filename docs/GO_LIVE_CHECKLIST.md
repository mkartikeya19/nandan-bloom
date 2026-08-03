# Go-Live Checklist — v1.0.0

Status legend: `[ ]` not done / not verified · `[x]` verified with evidence ·
`[M]` requires manual verification in production settings (cannot be proven
from the repository).

Date of last update: **2 August 2026**.

---

## 1. Infrastructure

| ✔   | Item                             | Evidence                                                                                                                       |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [M] | Database deployed                | Managed Cloud Postgres — verify in backend                                                                                     |
| [M] | All migrations applied           | 27 migration files present in `supabase/migrations/`; application to the production database must be confirmed by the operator |
| [x] | Migration structure verified     | `bun run verify:migrations` → _Migration verification passed (27 migrations)_ (local, 2 Aug 2026)                              |
| [M] | Storage buckets configured       | `students` and `teacher-documents` exist and are **private** — confirm in backend                                              |
| [M] | Environment variables configured | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` provisioned by the platform                   |

## 2. Authentication

| ✔   | Item                                  | Evidence                                                                                                                                                                          |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [M] | Public sign-up disabled               | No sign-up UI exists in `src/routes/auth.tsx` (sign-in only) — provider setting must be confirmed in backend auth settings                                                        |
| [x] | Invitation-only onboarding configured | `user_invitations` table, `invite_user()` RPC, `handle_new_user` trigger, `inviteUser` server function, Settings → Users UI                                                       |
| [x] | Password reset flow reviewed          | **Not implemented.** No reset/change-password screen; temporary password is not force-rotated. See [PRODUCTION_CONFIGURATION.md](./PRODUCTION_CONFIGURATION.md#5-password-policy) |
| [M] | Email confirmation / SMTP             | Not used by the app; confirm the provider setting matches intent                                                                                                                  |

## 3. Security

| ✔   | Item                                    | Evidence                                                                                                                       |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [x] | RLS enabled on all public tables        | Live check of `pg_tables` / `pg_policies`: all 32 public tables have `rowsecurity = true` and at least one policy (2 Aug 2026) |
| [x] | Storage policies present                | Role-scoped policies for both buckets in migrations `…a99e80d8…` and `…96a14183…`                                              |
| [x] | Role permissions defined in one place   | `src/lib/permissions.ts` + `permissions.test.ts`; mirrored by `has_role()` in RLS                                              |
| [M] | Role permissions verified in production | Requires signing in as each role — see [ROLE_VERIFICATION.md](./ROLE_VERIFICATION.md)                                          |
| [x] | Payment validation in the database      | `validate_fee_payment`, `validate_fee_payment_allocation`                                                                      |
| [x] | Audit logging                           | `activity_log` (append-only) + `logActivity()`                                                                                 |

## 4. Functional verification (manual)

None of these can be proven from source. Record results in
[UAT_REPORT_v1.0.0.md](./UAT_REPORT_v1.0.0.md).

- [ ] Student admission (with automatic fee-structure assignment)
- [ ] Fee collection (Quick Collect / Manual / Opening Balance only)
- [ ] Receipt void (with reason, ledger reversal)
- [ ] Bulk promotion (preview → commit → roll numbers)
- [ ] Teacher creation (Super Admin only)
- [ ] User invitation (temporary password + role grant on first sign-in)

## 5. Data migration

- [ ] Academic session created and Active (exactly one)
- [ ] Classes configured
- [ ] Sections configured
- [ ] Fee heads configured
- [ ] Fee structures created and **Complete** for every session + class in use
- [ ] Students imported
- [ ] Opening balances imported and reconciled against the source ledger

## 6. Release verification gates

Run from the repository root. Results below are from a **local** run on
3 August 2026 — they are not a substitute for CI on the release commit.

| Gate                   | Command                     | Local result                                                                    |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Migration verification | `bun run verify:migrations` | **PASS** — 30 migrations                                                        |
| Typecheck              | `bun run typecheck`         | **PASS** — no errors                                                            |
| Lint                   | `bun run lint`              | **PASS** — 0 errors, 9 accepted `react-refresh/only-export-components` warnings |
| Tests                  | `bun run test`              | **PASS** — 30/30 in 5 files                                                     |
| Build                  | `bun run build`             | **PASS** — production build succeeded                                           |

**CI:** the workflow `.github/workflows/ci.yml` runs all five gates.
_Verification pending. Requires successful CI execution against the release
commit._ No CI run result for the release commit is available from this
environment.

### Lint gate — resolved (3 August 2026)

The previous blocker (3,828 Prettier errors) was cleared by a formatting-only
remediation (`prettier --write`, `eslint --fix`) plus seven approved manual
fixes: regex escaping in `students-helpers.ts` / `teachers-helpers.ts` and
removal of `any` in five UI components. No business logic, API, migration, RLS
policy or component behaviour was changed. The nine remaining
`react-refresh/only-export-components` warnings are accepted for this release.

---

## 7. Deployment sign-off

| Role                                             | Name | Signature | Date |
| ------------------------------------------------ | ---- | --------- | ---- |
| Prepared by (developer)                          |      |           |      |
| Verified by (operator / IT)                      |      |           |      |
| Data migration signed off by (accounts)          |      |           |      |
| Approved for go-live by (Principal / Management) |      |           |      |

Go-live is approved only when every `[ ]` and `[M]` item above has been
completed and recorded, and the lint gate is green in CI for the release commit.
