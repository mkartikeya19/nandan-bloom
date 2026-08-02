# Architecture

## Overall architecture

```
Browser (React 19 + TanStack Router/Query)
        │  supabase-js  (anon/publishable key, user JWT)
        ▼
Supabase Postgres  ── RLS on every table
        │
        ├── SECURITY DEFINER RPCs  (admission, promotion, schedule generation,
        │                           roll numbers, sequences, role checks)
        ├── Triggers               (updated_at, validation, ledger recompute)
        └── Storage buckets        (students, teacher-documents — both private)
```

There is **no custom API layer**. The React app talks to Postgres directly via
PostgREST through `supabase-js`; all authorization is enforced by RLS policies
and by `SECURITY DEFINER` functions that re-check `has_role(auth.uid(), …)`.

TanStack Start provides SSR and the file-based router. `src/server.ts` wraps the
SSR entry to convert catastrophic errors into a rendered error page.
`src/start.ts` registers `attachSupabaseAuth` as a client `functionMiddleware`
and an error-capturing `requestMiddleware`. No `createServerFn` server functions
are currently used by feature code — business logic lives in the database.

## Frontend structure

- **Routes** (`src/routes`) hold page-level composition and data fetching.
- **Feature components** (`src/components/<feature>`) hold forms, dialogs and
  tab bodies that are reused by more than one route or are large enough to split.
- **UI primitives** (`src/components/ui`) are shadcn/ui generated files.
- **Helpers** (`src/lib/*-helpers.ts`) hold pure constants, formatting and
  domain calculations plus thin Supabase wrappers (RPC calls, storage uploads).
- **Hooks** (`src/hooks`) hold cross-cutting concerns — currently roles and
  mobile detection.

## Backend structure

Everything is Postgres:

- Tables in the `public` schema with explicit `GRANT`s and RLS enabled.
- Enum types for statuses/frequencies (see DATABASE.md).
- `SECURITY DEFINER` functions for anything multi-step or privileged.
- Triggers for `updated_at`, referential validation (section↔class, fee
  structure↔record), session status transitions, exam-pattern locking, grade
  band overlap, and payment-allocation recomputation.
- Storage: `students` (photos/documents) and `teacher-documents`, both private;
  files are read via short-lived signed URLs.

## Routing

File-based, flat convention under `src/routes`:

| File | URL |
| --- | --- |
| `index.tsx` | `/` → redirects to `/dashboard` |
| `auth.tsx` | `/auth` (public, `ssr: false`) |
| `_authenticated/route.tsx` | auth gate + sidebar layout, renders `<Outlet />` |
| `_authenticated/dashboard.tsx` | `/dashboard` |
| `_authenticated/students.index.tsx` | `/students` |
| `_authenticated/students.new.tsx` | `/students/new` |
| `_authenticated/students.$studentId.tsx` | `/students/:studentId` |
| `_authenticated/students.$studentId.edit.tsx` | `/students/:studentId/edit` |
| `_authenticated/students.import.tsx` | `/students/import` |
| `_authenticated/students.promote.tsx` | `/students/promote` |
| `_authenticated/fees.index.tsx` | `/fees` |
| `_authenticated/fees.structures.index.tsx` / `.$structureId.tsx` | `/fees/structures`, `/fees/structures/:id` |
| `_authenticated/fees.collect.index.tsx` / `.$studentId.tsx` | `/fees/collect`, `/fees/collect/:studentId` |
| `_authenticated/fees.receipts.index.tsx` / `.$paymentId.tsx` | `/fees/receipts`, `/fees/receipts/:id` |
| `_authenticated/fees.concessions.tsx` | `/fees/concessions` |
| `_authenticated/fees.import.tsx` | `/fees/import` (opening balance migration) |
| `_authenticated/fees.report.$view.tsx` | `/fees/report/:view` |
| `_authenticated/fees.settings.tsx` | `/fees/settings` |
| `_authenticated/examinations.index.tsx` | `/examinations` |
| `_authenticated/examinations.subjects.tsx` | `/examinations/subjects` |
| `_authenticated/examinations.grade-scales.tsx` | `/examinations/grade-scales` |
| `_authenticated/examinations.patterns.index.tsx` / `.$patternId.tsx` | `/examinations/patterns`, `/examinations/patterns/:id` |
| `_authenticated/teachers.index.tsx` / `.$teacherId.tsx` | `/teachers`, `/teachers/:id` |
| `_authenticated/activity.tsx` | `/activity` |
| `_authenticated/settings.tsx` | `/settings` |
| `_authenticated/admissions.tsx`, `attendance.tsx`, `reports.tsx` | placeholder/secondary screens, hidden from the sidebar |

**Critical routing convention:** a module with child routes must use
`module.index.tsx` for its landing page. A bare `module.tsx` becomes a *layout*
route and — unless it renders `<Outlet />` — swallows all child routes (this
caused past regressions in Students and Fees). Never reintroduce
`students.tsx` / `fees.tsx` / `fees.collect.tsx` / `fees.structures.tsx`.

`src/routeTree.gen.ts` is generated; never edit it.

## Authentication

- Supabase email/password auth. `/auth` offers sign-in and sign-up tabs.
- `_authenticated/route.tsx` has `ssr: false` and a `beforeLoad` that calls
  `supabase.auth.getUser()`, redirecting to `/auth` when there is no session.
- `/auth` redirects an existing session to `/dashboard` and listens to
  `onAuthStateChange`.
- Roles are **not** on the profile. They live in `public.user_roles` and are
  read through `useUserRoles()`; the database enforces them via
  `public.has_role(uuid, app_role)`.
- `claim_first_admin()` lets the very first user bootstrap `admin` +
  `super_admin` when no super admin exists yet.

## State management

- **Server state:** TanStack Query. Query keys are descriptive string arrays
  (e.g. `["students", sessionId]`, `["current-user-roles"]`). Mutations
  invalidate the affected keys; several screens use `staleTime` for masters.
- **Local UI state:** `useState` inside the route/component. No global store.
- **Forms:** controlled component state or `react-hook-form`, depending on the
  screen; validation gates the submit button rather than failing after submit.
- **Notifications:** `sonner` `toast` for success/error feedback.

## Component organization

1. Route file = page: header (`PageHeader`), filters, data fetching, layout.
2. Anything reused or > ~200 lines moves to `src/components/<feature>/`.
3. Dialogs live next to their feature (`students/promote-dialog.tsx`,
   `students/mark-left-dialog.tsx`, `fees/opening-balance-breakup.tsx`).
4. Tabbed screens keep one component per tab (`components/settings/*-tab.tsx`,
   `components/fees/fees-tabs.tsx` for fee sub-navigation).
5. Colors/shadows come from design tokens in `src/styles.css`; components never
   hardcode hex values or `text-white`/`bg-black`.
