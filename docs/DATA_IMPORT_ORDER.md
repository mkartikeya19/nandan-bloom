# Data Import Order

Import in this exact order. Every step depends on the ones above it; the
Migration Dashboard blocks a step until its prerequisites exist.

| #  | Step                       | Where                            | Required | Depends on            |
| -- | -------------------------- | -------------------------------- | -------- | --------------------- |
| 1  | Academic Sessions          | Settings → Academic Sessions     | Yes      | —                     |
| 2  | Classes                    | Settings → Classes               | Yes      | 1                     |
| 3  | Sections                   | Settings → Sections              | Yes      | 2                     |
| 4  | Houses                     | Settings → Houses                | Optional | —                     |
| 5  | Fee Heads                  | Settings → Fee Heads             | Yes      | —                     |
| 6  | Fee Structures             | Fees → Fee Structures            | Yes      | 1, 2, 5               |
| 7  | Students                   | Migration → Student Migration    | Yes      | 1, 2, 3, 6            |
| 8  | Teachers                   | Teachers                         | Optional | —                     |
| 9  | Opening Balances           | Fees → Opening Balance Migration | Optional | 7                     |
| 10 | Generate Fee Schedules     | Automatic during step 7          | Yes      | 6, 7                  |
| 11 | Go-Live Validation         | Migration → Go-Live Validation   | Yes      | all of the above      |

## Notes per step

1. **Academic Sessions** — create the current session and any historical
   sessions needed for opening balances. Exactly one session may be `Active`.
2. **Classes** — scoped to a session; set `order_index` for correct ordering.
3. **Sections** — scoped to a class. A class may legitimately have none.
4. **Houses** — optional; referenced by name during the student import.
5. **Fee Heads** — configure frequency, applicable months, applicability,
   auto-generate and charge trigger before building structures.
6. **Fee Structures** — one Active + **Complete** structure per class per
   session. A structure is Complete when every active mandatory fee head has a
   non-zero amount. Admission fails if a class has zero or more than one match.
7. **Students** — Excel wizard. Creates the student, the academic record and
   the fee schedule in a single transaction per row.
8. **Teachers** — Super Admin only; employee codes come from the
   `NKS-0000` sequence.
9. **Opening Balances** — amount plus optional session/fee-head breakup, stored
   as historical reference only.
10. **Fee Schedules** — generated automatically; re-runnable and idempotent via
    "Refresh Schedule" on the student's Fees tab.
11. **Go-Live Validation** — must report **READY FOR GO LIVE** before live
    operations start.

## Rollback window

Each import is a tracked migration batch. Only the most recent batch can be
rolled back, and only while no fee collection, admission or promotion has
happened since. Complete each step's verification before moving on.
