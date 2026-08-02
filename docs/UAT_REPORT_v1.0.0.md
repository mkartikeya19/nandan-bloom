# UAT / Manual Regression Report — v1.0.0

**Build under test:** v1.0.0 “Core ERP Foundation”
**Environment:** _to be recorded_ (preview / production)
**Tester:** _to be recorded_
**Date:** _to be recorded_

> **This report is not complete.** The automated gates below were executed and
> their results are factual. The manual regression scenarios have **not** been
> executed; they are recorded as `Not executed` and must be filled in by a
> tester before go-live. Do not mark any scenario Pass without an observed
> result.

---

## 1. Automated gates (executed 2 August 2026, local)

| Gate                     | Command                     | Result                                                                                                                                            |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration verification   | `bun run verify:migrations` | **PASS** — 27 migrations                                                                                                                          |
| Typecheck                | `bun run typecheck`         | **PASS**                                                                                                                                          |
| Lint                     | `bun run lint`              | **FAIL** — 3,828 errors + 9 warnings, all formatting (`prettier/prettier`) and `react-refresh/only-export-components`. No type or logic failures. |
| Unit tests               | `bun run test`              | **PASS** — 30/30 across 5 files                                                                                                                   |
| Production build         | `bun run build`             | **PASS**                                                                                                                                          |
| CI on the release commit | `.github/workflows/ci.yml`  | **Not executed / not observed**                                                                                                                   |

Unit suites: fee allocation (`fees-helpers.test.ts`), opening balance
(`opening-balance.test.ts`), receipt voiding (`receipts.test.ts`), promotion
(`promotion-helpers.test.ts`), permissions (`permissions.test.ts`).

## 2. Manual regression scenarios

| #   | Scenario                                   | Expected                                                                                             | Result       | Notes |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------ | ----- |
| 1   | Bootstrap first Super Admin                | Claim-admin banner grants `admin` + `super_admin`; banner disappears                                 | Not executed |       |
| 2   | Invite a user                              | Invitation listed; temporary password shown once; roles granted on first sign-in                     | Not executed |       |
| 3   | Revoke a pending invitation                | Invitation marked revoked; sign-up still impossible                                                  | Not executed |       |
| 4   | Configure session / classes / sections     | Exactly one session Active; second activation rejected                                               | Not executed |       |
| 5   | Create a fee structure                     | Draft until all mandatory heads priced, then Complete; lock prevents edits                           | Not executed |       |
| 6   | Admit a student                            | Fee structure auto-assigned; schedule generated July→April; no May/June rows                         | Not executed |       |
| 7   | Admission with no Complete structure       | Blocked with a clear message                                                                         | Not executed |       |
| 8   | Admission with duplicate Active structures | Blocked with a duplicate-structure message                                                           | Not executed |       |
| 9   | Excel student import                       | Summary of created / skipped / failed rows                                                           | Not executed |       |
| 10  | Opening balance — manual entry             | Breakup rows saved; total matches the academic record                                                | Not executed |       |
| 11  | Opening balance — Excel import             | Multiple breakup rows per scholar combine into one opening balance                                   | Not executed |       |
| 12  | Student profile → Fees tab                 | Live ledger, schedule, receipts, View Breakup                                                        | Not executed |       |
| 13  | Quick Collect                              | Full settlement only; partial payment rejected with a banner                                         | Not executed |       |
| 14  | Manual Allocation                          | Priority order Opening Balance → Admission → Activities → Monthly (chronological) → Other → Optional | Not executed |       |
| 15  | Opening Balance Only mode                  | Allocates against opening balance rows only                                                          | Not executed |       |
| 16  | Receipt generation                         | Receipt number issued; school name and totals render; print works                                    | Not executed |       |
| 17  | Void a receipt                             | Reason mandatory; ledger reversed; schedule statuses recomputed                                      | Not executed |       |
| 18  | Void attempted by Reception                | Not offered                                                                                          | Not executed |       |
| 19  | Concession (amount and percentage)         | Applied per head or across heads; logged to Activity                                                 | Not executed |       |
| 20  | Bulk promotion                             | Preview matches commit; single transaction; schedules created                                        | Not executed |       |
| 21  | Roll-number regeneration                   | Alphabetical by student name within class                                                            | Not executed |       |
| 22  | Mark student Left                          | Status and leaving details recorded                                                                  | Not executed |       |
| 23  | Teacher create / edit                      | Employee code `NKS-0000` format; documents upload to the private bucket                              | Not executed |       |
| 24  | Teachers as Admin                          | Inaccessible                                                                                         | Not executed |       |
| 25  | Examination masters                        | Subjects, components, grade scales, versioned patterns, clone                                        | Not executed |       |
| 26  | Activity Center                            | Human-readable entries for admission, payment, void, concession, documents                           | Not executed |       |
| 27  | System Health                              | Lists academic records missing a fee structure; repair link works                                    | Not executed |       |
| 28  | Fee reports                                | Five KPI cards drill down; opening balance report exports to Excel                                   | Not executed |       |
| 29  | Route smoke test                           | No blank pages, no console runtime errors across all sidebar routes                                  | Not executed |       |
| 30  | Role smoke test                            | Per-role sidebar and actions match [ROLE_VERIFICATION.md](./ROLE_VERIFICATION.md)                    | Not executed |       |

## 3. Defects found

| ID    | Severity        | Description                                                                                                                                                                                    | Status |
| ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| OPS-1 | Low (blocks CI) | `bun run lint` fails on 3,828 Prettier formatting errors and 9 `react-refresh` warnings. No runtime, type or test impact. Fix requires touching source files — proposed and awaiting approval. | Open   |

## 4. Conclusion

Automated correctness gates (types, tests, build, migration structure) pass.
The lint gate fails on formatting, and **no manual regression scenario has been
executed**. On the evidence available, the release status is:

**Release Candidate – Operational Verification Pending.**
