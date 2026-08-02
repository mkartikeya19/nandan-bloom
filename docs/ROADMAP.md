# Roadmap

Status legend: **Completed** = shipped in v1.0.0 and feature-frozen.
**Planned** = not implemented; anything described is a target, not a promise of
current behaviour.

## Completed (v1.0.0 — Core ERP Foundation)

| Area               | Notes                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard          | Operational counters + first-admin bootstrap                                                                                                                   |
| Student Management | Master, profile, documents, academic history, Excel import, status lifecycle                                                                                   |
| Admissions         | Validated admission form, single-transaction admission with automatic fee structure assignment, Admission Register at `/admissions`                            |
| Fee Management     | Heads, structures, schedule generation, opening balances and migration, three collection modes, receipts + void, concessions, dashboard and drill-down reports |
| Promotion          | Bulk wizard with preview, single-transaction commit, roll-number regeneration                                                                                  |
| Teacher Management | Super-Admin-only HR records, employee codes, bank/salary, private documents                                                                                    |
| Authentication     | Supabase email/password, invitation-only onboarding, role gate on every route                                                                                  |
| Security Hardening | RLS + GRANTs everywhere, DB-enforced payment validation, immutable receipts, append-only audit log, private buckets                                            |
| User Management    | Invitations, role assignment, revocation, activity attribution                                                                                                 |

Examination **configuration** (subjects, components, grade scales, versioned
patterns) also shipped in v1.0.0. Marks and results did not.

## Planned

| Area                  | Target | Summary                                                                                                                                        |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Examination (Phase 2) | v1.1.0 | Marks entry per class-subject component, term aggregation with pattern weightage, grade derivation, result publication, printable report cards |
| Attendance            | v1.1.0 | Daily/period marking UI on the existing `attendance` table, class registers, monthly summaries, links to the student profile tab               |
| Payroll               | v1.2.0 | Salary runs on the existing `teachers` salary fields, allowances/deductions, payslips                                                          |
| Certificates          | v1.2.0 | Transfer certificate, bonafide and character certificates generated from student + academic records                                            |
| Reports               | v1.3.0 | Consolidated enrolment, fee, attendance and exam reporting to replace the static `/reports` placeholder                                        |

Integration approach for each of these — without changing the core data model —
is documented in [FUTURE_INTEGRATIONS.md](./FUTURE_INTEGRATIONS.md).

## Explicitly out of scope for now

- Multi-school / multi-tenant deployment
- Parent or student logins
- Online payment gateway collection
- Transport, hostel and library modules
- Native mobile applications
