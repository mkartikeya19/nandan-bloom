# AI Context & Contributor Guide

Read this before changing anything. It captures conventions that are not obvious
from the code and the failure modes this project has already hit.

**Release state: v1.0.0 — Core ERP Foundation, feature-frozen.** Only production
bug fixes ship in `v1.0.x`; new functionality targets `v1.1.0`
([ROADMAP.md](./ROADMAP.md)). The `/docs` folder is the single source of truth —
a change is not complete until the affected doc is updated in the same commit.

Start here: [WORKFLOW.md](./WORKFLOW.md) for how a flow runs end to end,
[DECISIONS.md](./DECISIONS.md) for *why* the hard constraints exist,
[PERMISSIONS.md](./PERMISSIONS.md) for who may do what,
[SECURITY.md](./SECURITY.md) for the enforcement model, and
[CONTRIBUTING.md](./CONTRIBUTING.md) for process.

## Coding conventions

- **TypeScript strict.** No `any` unless wrapping an untyped RPC — and then with
  an `eslint-disable-next-line` comment, as done in the helper files.
- **Imports** use the `@/` alias for everything under `src/`.
- **Components** are function components with named exports; route files export
  `Route` (via `createFileRoute`) plus a local page component.
- **Styling:** Tailwind v4 utility classes with semantic design tokens from
  `src/styles.css`. Never hardcode colors (`text-white`, `bg-black`,
  `bg-[#hex]`) — they break theming.
- **UI:** always reuse `@/components/ui/*` (shadcn/ui). Do not install another
  component library.
- **Icons:** `lucide-react` only.
- **Toasts:** `sonner` (`import { toast } from "sonner"`). There is no
  `use-toast` hook in this project.
- **Money:** always render through `formatINR()`; never `toFixed()` inline.
- **Dates:** ISO `YYYY-MM-DD` for storage; `date-fns` for display.
- **Data fetching:** TanStack Query with descriptive array keys; invalidate the
  affected keys after every mutation instead of refetching manually.
- **Audit:** any create/update/delete a user can trigger should call
  `logActivity()`.

## Project conventions

- **Routing:** flat file-based routes. A module with children **must** name its
  landing page `module.index.tsx`. A bare `module.tsx` becomes a layout route
  and hides its children unless it renders `<Outlet />`. This has broken
  Students and Fees before — do not reintroduce `students.tsx`, `fees.tsx`,
  `fees.collect.tsx` or `fees.structures.tsx`.
- **Business logic lives in Postgres.** Multi-step operations (admission,
  promotion, schedule generation, roll numbers) are `SECURITY DEFINER` functions
  so they are atomic and authorization is enforced server-side. Do not
  reimplement them client-side.
- **Permissions are declared once** in `src/lib/permissions.ts` (consumed via
  `useUserRoles()` in `src/hooks/use-user-role.ts`) and mirrored
  by RLS. When adding a capability, update both.
- **Roles never live on `profiles` or `students`** — only `user_roles`.
- **Idempotency:** `generate_student_fee_schedule` relies on the unique key
  `(academic_record_id, fee_head_id, period_label)`. Keep it.
- **Migrations are append-only.** Add a new timestamped file; never edit an
  applied one. Every new public table needs `GRANT`s + RLS + policies in the
  same migration.
- **Domain vocabulary:** "academic record" = one student's enrolment in one
  session; "schedule" = the generated ledger rows; "structure" = the priced
  template for a session+class; "head" = a global fee category.

## Reusable components & utilities

| Use this | Instead of |
| --- | --- |
| `PageHeader` (`@/components/page-header`) | ad-hoc page titles |
| `EmptyState` (`@/components/empty-state`) | inline "no data" markup |
| `FeesTabs` (`@/components/fees/fees-tabs`) | duplicating fee sub-navigation |
| `ReadOnlyNotice` (`@/components/settings/read-only-notice`) | custom permission banners |
| `StudentFeesTab`, `OpeningBalanceBreakup` | re-querying the ledger |
| `useUserRoles()` / `buildPermissions()` | reading `user_roles` or hand-rolling role checks in a component |
| `src/lib/date.ts` helpers | ad-hoc `toLocaleDateString()` / inline date formats |
| `src/services/*` query modules | new inline Supabase queries inside route files |
| `formatINR`, `amountInWords`, `formatSalary`, `maskAccount` | manual formatting |
| `allocatePayment`, `comparePriority`, `outstandingOf` | re-deriving allocation logic |
| `uploadStudentFile` / `uploadTeacherFile` + signed-URL helpers | direct storage calls |

## Things AI assistants should never change

1. **Auto-generated files:** `src/integrations/supabase/client.ts`,
   `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`,
   `src/routeTree.gen.ts`, `.env`, `supabase/config.toml`.
2. **Applied migrations** in `supabase/migrations/`.
3. **The routing convention** (`*.index.tsx`) described above.
4. **Payment immutability:** never add a delete path for `fee_payments`;
   corrections are void-and-repost only.
5. **Partial payments:** collection modes require full settlement — do not relax
   this validation.
6. **May and June are never billed** by the schedule generator (tuition runs
   July → April).
7. **Fee allocation priority:** Opening Balance → Admission → Activities →
   Monthly chronological → Other → Optional.
8. **One Active academic session** at a time and the allowed status transitions.
9. **Admission is blocked** without exactly one Active + Complete fee structure
   for the session/class.
10. **Teachers module is Super Admin only** — do not widen the RLS policy or the
    sidebar condition.
11. **`activity_log` is append-only**; `logActivity()` must never throw.
12. **Storage buckets stay private**; never make them public.
13. **Roles stay in `user_roles`.**
14. Do not swap the router, add `react-router-dom`, create `src/pages/`, or add
    an `App.tsx` page switcher.
15. Do not add Node-only packages — the server runs on a Cloudflare Worker.
16. **Public sign-up stays disabled.** Accounts are created by invitation only;
    `claim_first_admin()` is the sole bootstrap path.
17. **Payment validation triggers stay in the database** — never move these
    checks to the client alone.

## Recommended workflow for future contributors

1. **Read first.** Find the module in [MODULES.md](./MODULES.md), then its rules
   in [BUSINESS_RULES.md](./BUSINESS_RULES.md) and its data in
   [DATABASE.md](./DATABASE.md).
2. **Decide the layer.** Validation and multi-step/authorization-sensitive logic
   belongs in the database; presentation belongs in the route/component.
3. **Schema changes** ship as one new migration containing
   `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → policies, plus an
   `updated_at` trigger. Regenerate types afterwards (do not hand-edit them).
4. **Permissions:** add the flag to `src/lib/permissions.ts` *and* the matching
   RLS policy / `has_role()` check, plus a case in `permissions.test.ts`.
5. **Instrument:** add a `logActivity()` call and, if the payload is new, a
   branch in `formatActivityDetails()`.
6. **Test:** extend the unit suites in `src/lib/__tests__` for any pure logic you
   touch ([TESTING.md](./TESTING.md)).
7. **Verify:** `bun run verify:migrations && bun run typecheck && bun run lint &&
   bun run test && bun run build`, then exercise the affected flow in the preview
   (admission → schedule → collect → receipt is the highest-value regression
   path).
7. **Document:** update the relevant file in `/docs` in the same change.
