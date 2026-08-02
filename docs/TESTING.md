# Testing

## Tooling

| Concern | Tool | Command |
| --- | --- | --- |
| Unit tests | Vitest (`vitest.config.ts`) | `bun run test` |
| Type checking | TypeScript (strict) | `bun run typecheck` |
| Lint | ESLint (`eslint.config.js`) | `bun run lint` |
| Migration hygiene | `scripts/verify-migrations.mjs` | `bun run verify:migrations` |
| Production build | Vite / TanStack Start | `bun run build` |

CI (`.github/workflows/ci.yml`) runs migration verification → typecheck → lint →
tests → build on every push and pull request.

## Strategy

The app talks to Postgres directly, so the test pyramid is deliberately shaped:

1. **Pure logic is extracted and unit-tested.** Anything arithmetic or
   rule-driven lives in `src/lib/*.ts` with no Supabase import, so it can be
   tested without mocks:
   - `fees-helpers.ts` — allocation priority, `allocatePayment`, `outstandingOf`,
     `formatINR`, `amountInWords`
   - `opening-balance.ts` — breakup grouping and validation
   - `receipts.ts` — void arithmetic and receipt status
   - `promotion-helpers.ts` — chronological sessions, next class resolution
   - `permissions.ts` — role → capability mapping
2. **Business invariants live in the database**, so they are enforced rather than
   tested in the client: triggers and constraints (payment validation, one active
   session, section↔class, locked patterns) cannot be bypassed by any client
   path.
3. **UI is verified manually** against the regression path below. There is no
   component or end-to-end test runner in this release.

## Test suites

`src/lib/__tests__/`:

| File | Covers |
| --- | --- |
| `fees-helpers.test.ts` | Allocation priority order (opening → admission → activities → monthly chronological → other → optional), full/partial allocation maths, currency and words formatting |
| `opening-balance.test.ts` | Grouping breakup rows by scholar number, totals, row validation |
| `receipts.test.ts` | Void reversal arithmetic, receipt status derivation |
| `promotion-helpers.test.ts` | Eligible destination sessions (chronologically later only), next-class resolution |
| `permissions.test.ts` | Every role's capability set, `super_admin ⇒ admin`, no-role user |

Run a single file: `bunx vitest run src/lib/__tests__/fees-helpers.test.ts`.

## Writing a new test

- Put pure logic in `src/lib/`, never inside a route component — a rule that
  cannot be imported cannot be tested.
- Name tests after the business rule, not the function
  (`"opening balance is allocated before admission fee"`).
- Use realistic amounts in paise-safe rounding (2 decimals) so rounding bugs
  surface.
- When a bug is fixed, add the failing case first.

## Manual regression path (run before any release)

1. **Settings** — create a Draft session, activate it, add classes/sections,
   confirm only one session is Active.
2. **Fee setup** — configure fee heads, build a fee structure for the session +
   class, confirm it flips from Draft to Complete.
3. **Admission** — admit a student; confirm the fee structure is auto-assigned
   and the schedule is generated (no May/June tuition rows).
4. **Collection** — collect via Quick Collect, then Manual Allocation; confirm a
   partial amount is rejected and allocation order matches the priority.
5. **Receipt** — open the receipt from the register, print, then void with a
   reason; confirm the ledger reverses and the schedule row returns to Pending.
6. **Opening balance** — enter a breakup manually, re-run schedule generation,
   confirm idempotency and the "View Breakup" dialog.
7. **Promotion** — run the wizard on a class, check the preview, commit, confirm
   new records, schedules and alphabetical roll numbers.
8. **Teachers** — as Super Admin create a teacher, upload a document, verify the
   signed URL works and that a non-super-admin cannot reach `/teachers`.
9. **Activity Center** — confirm each of the above produced a readable entry.

## Known gaps

- No component/DOM tests and no browser end-to-end suite.
- Database triggers and RLS policies are not covered by automated tests; they are
  exercised manually through the path above.
- Examination calculations have no tests because marks and results are not
  implemented (planned with the Phase 2 module).
