# Migration Guide

How to onboard an existing school (masters, students, teachers, opening
balances) into the ERP safely, with validation and rollback.

Everything described here lives under **Settings → Data Migration**, or
directly at `/migration`.

Access: **Admin** and **Super Admin** only (RLS and the migration RPCs enforce
this in the database, not just in the UI).

---

## 1. Migration Dashboard (`/migration`)

Shows the record count and status of every master and transactional entity:

| Module            | Required | Notes                                   |
| ----------------- | -------- | --------------------------------------- |
| Academic Sessions | Yes      | Exactly one must be `Active`            |
| Classes           | Yes      | Scoped to a session                     |
| Sections          | Yes      | Scoped to a class                       |
| Houses            | No       | Optional master                         |
| Fee Heads         | Yes      | Frequency / applicability configured    |
| Fee Structures    | Yes      | Must be **Active + Complete** per class |
| Students          | Yes      | Imported through the wizard             |
| Academic Records  | Yes      | Created automatically per student       |
| Fee Schedules     | Yes      | Generated from the fee structure        |
| Teachers          | No       | Entered in the Teachers module          |
| Opening Balances  | No       | Migrated separately                     |

Steps stay **Blocked** until their prerequisites exist — you cannot import
students before sessions, classes, sections, fee heads and fee structures are
in place.

---

## 2. Student Migration Wizard (`/migration/students`)

**Step 1 — Download template.** 37 columns. Session, Class, Section and House
values must match existing master records exactly.

**Step 2 — Upload & validate.** Every row is validated before anything is
written. Invalid rows are listed with their exact errors and can be downloaded
as an Excel **error report**.

**Step 3 — Commit.** Valid rows only. Each row runs the single-transaction
`admit_student_with_fee_structure` RPC, which:

1. creates the `students` row,
2. creates the `student_academic_records` row for the chosen
   session / class / section,
3. resolves the one Active + Complete fee structure for that class and session
   (admission is blocked when there are zero or more than one matches), and
4. generates the current-session fee schedule.

**Step 4 — Opening balances**, then **Go-Live Validation**.

Every committed import is recorded as a **migration batch** (see §6).

---

## 3. Opening Balance Import (`/fees/import`)

Migrates previous-session dues. Fields: Scholar Number, Student Name, Opening
Balance, previous academic session(s) and remarks, with an optional
session-wise / fee-head-wise **breakup**.

The breakup is stored in `opening_balance_details` as historical reference. The
single `student_academic_records.opening_balance` amount remains the value the
fee-collection engine uses — the collection logic is unchanged.

The breakup is viewable per student from the Student Profile → Fees tab
("View Breakup").

---

## 4. Validation Engine

Nothing is written until validation passes. The importers check:

- Duplicate Scholar Numbers (in the file and against the database)
- Missing mandatory fields (Scholar Number, Full Name, Date of Admission,
  Session, Class, Section)
- Invalid Class (not found in the chosen session)
- Invalid Section (not found in the chosen class)
- Invalid House
- Missing Academic Session
- Missing or ambiguous Fee Structure (zero or multiple Active + Complete
  matches)
- Invalid Opening Balance (non-numeric or negative)
- Duplicate Teacher Employee ID (enforced by the unique constraint and the
  `next_employee_code()` sequence)

Invalid rows are skipped, never partially imported, and can be exported.

---

## 5. Go-Live Validation (`/migration/go-live`)

One click runs the `go_live_validation()` RPC, which returns
**READY FOR GO LIVE** or **NOT READY** with per-check detail:

1. Exactly one Academic Session is Active
2. Every active student has exactly one active academic record
3. Every active student has a Complete Fee Structure
4. Every active student has a generated fee schedule
5. No orphan fee schedules
6. No duplicate Scholar Numbers
7. No duplicate Employee IDs
8. No invalid Opening Balances

---

## 6. Migration Batches & Rollback (`/migration/batches`)

Each import creates a row in `migration_batches` plus one
`migration_batch_items` row per created entity.

Rollback rules (enforced by `rollback_migration_batch()`):

- Only the **most recent, not-yet-rolled-back** batch can be rolled back.
- Rollback is **blocked** if any fee payment, admission or promotion happened
  after the batch was created.
- Rollback deletes the batch's students, academic records, generated fee
  schedules and opening-balance details, then marks the batch as rolled back.
- The UI shows an explicit warning before rollback; the action is irreversible.

---

## 7. After migration

Run Go-Live Validation until it reports READY, then operate the ERP internally
for a short pilot before enabling wider access.
