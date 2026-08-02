# Release Notes — v1.0.0 "Core ERP Foundation"

**Release date:** 2 August 2026
**Tag:** `v1.0.0`
**Scope:** Nandan Kids Higher Secondary School — internal, staff-only ERP.

This is the first production release. It establishes the data model, security
model and operational workflows that every future module will build on.

## Features

| Area | What you can do |
| --- | --- |
| Dashboard | See operational counters; the very first user claims the admin role |
| Students | Admit, search, edit, archive; manage documents and academic history |
| Admission | Guided form with validation; fee structure assigned automatically in one transaction |
| Promotion | Bulk promotion wizard with preview and alphabetical roll-number regeneration |
| Fees — setup | Global fee heads, session+class fee structures, Draft/Complete status, lock |
| Fees — ledger | Idempotent schedule generation, July→April tuition, opening balances with itemised breakup |
| Fees — collection | Quick Collect, Manual Allocation and Opening Balance Only, with allocation preview |
| Fees — receipts | Receipt register, receipt detail with print, void-with-reason workflow |
| Fees — reporting | Five KPI cards with drill-down reports, opening balance report with Excel export |
| Concessions | Amount or percentage concessions per head or across all heads, with approval |
| Teachers | Confidential HR records, auto employee code, bank/salary details, private documents |
| Examinations | Configuration masters: subjects, components, grade scales, versioned patterns |
| Activity Center | Global append-only audit trail with human-readable summaries |
| Settings | School profile, sessions, classes, sections, houses, fee heads, users, invitations, system health |

## Improvements

- **Invitation-only onboarding.** Public sign-up is disabled; Super Admins invite
  staff and roles are granted automatically on first sign-in.
- **Financial integrity enforced in the database.** Positive amounts, immutable
  receipts, and allocations that can never exceed outstanding or receipt totals.
- **Single source of truth for permissions** (`src/lib/permissions.ts`) consumed
  by every screen and mirrored by RLS.
- **Service layer** (`src/services/*`) isolates Supabase queries from components.
- **Standardised dates and currency** (`src/lib/date.ts`, `formatINR`) removing
  hydration mismatches and inconsistent formatting.
- **Automated quality gate:** unit tests for fee allocation, opening balance,
  receipt voiding and promotion, plus a migration linter, all wired into CI.
- **Foreign-key indexes** across fee and student tables.

## Known limitations

- **Examinations is configuration-only.** Marks entry, results and report cards
  are not implemented.
- **Attendance is read-only.** `/attendance` displays existing rows; there is no
  marking UI, and the route is not in the sidebar.
- **`/reports`** is a static list of planned reports. The working reports live
  under `/fees/report/:view`.
- **`/admissions`** (Admission Register) is reachable by URL only.
- **No payroll, certificates or transport modules.**
- **No email delivery.** Invitations issue a temporary password shown once to the
  inviting Super Admin; it must be shared out of band.
- **Partial payments are intentionally not supported** in any collection mode.
- Multi-school / multi-tenant operation is not supported; the deployment serves
  one school.

## Future roadmap

`v1.1.0 — Academic Operations`: attendance marking, examination marks entry,
results and report cards.
Later: payroll, certificates (TC/bonafide), consolidated reporting and parent
communication. See [ROADMAP.md](./ROADMAP.md) and
[FUTURE_INTEGRATIONS.md](./FUTURE_INTEGRATIONS.md).

## Upgrade / freeze policy

After this tag the core modules are **feature-frozen**. Only production bug
fixes ship in `v1.0.x`; all new functionality targets `v1.1.0`.
