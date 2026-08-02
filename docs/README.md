# Nandan Kids School ERP — Documentation

Internal ERP for **Nandan Kids Higher Secondary School**. Staff-only web application
covering student records, admissions register, fee management, promotions,
examination masters, teacher HR records and an audit/activity log.

> This documentation describes the **current implementation only**. Anything not
> listed here is not built.

**Current release: v1.0.0 — Core ERP Foundation.** Core modules are
feature-frozen; see [CHANGELOG.md](./CHANGELOG.md) and
[RELEASE_NOTES.md](./RELEASE_NOTES.md).

## Documentation index

| File | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App architecture, routing, auth, state, component layout |
| [DATABASE.md](./DATABASE.md) | Tables, columns, enums, relationships, RPCs, triggers, migrations |
| [MODULES.md](./MODULES.md) | Every implemented module, screens, permissions |
| [BUSINESS_RULES.md](./BUSINESS_RULES.md) | Rules enforced in code and in the database |
| [WORKFLOW.md](./WORKFLOW.md) | End-to-end operational flows across modules |
| [API.md](./API.md) | RPCs, storage APIs, helper/service utilities |
| [PERMISSIONS.md](./PERMISSIONS.md) | Roles, capability matrix, database mirror |
| [SECURITY.md](./SECURITY.md) | Auth, invitations, RLS, financial integrity, storage |
| [TESTING.md](./TESTING.md) | Test tooling, suites, manual regression path |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Hosting, environment, release checklist, rollback |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Process, conventions, review checklist |
| [DECISIONS.md](./DECISIONS.md) | Architecture decision records |
| [ROADMAP.md](./ROADMAP.md) | Completed vs planned work |
| [FUTURE_INTEGRATIONS.md](./FUTURE_INTEGRATIONS.md) | How planned modules attach to the foundation |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |
| [RELEASE_NOTES.md](./RELEASE_NOTES.md) | v1.0.0 release summary |
| [AI_CONTEXT.md](./AI_CONTEXT.md) | Conventions, do-not-touch list, contributor workflow |


## Project overview

A single-page/SSR hybrid React app. All data lives in a managed Postgres
(Supabase) backend accessed directly from the browser through the Supabase JS
client with Row Level Security; heavier multi-step operations (admission,
promotion, fee schedule generation) run as `SECURITY DEFINER` Postgres functions.

Core capabilities that exist today:

- Student admission, profile, documents, Excel import, status lifecycle
- Automatic fee-structure assignment at admission + fee schedule generation
- Fee collection (Quick Collect / Manual allocation / Opening Balance only),
  receipts with void workflow, concessions, reports
- Opening-balance migration utility with detailed breakup
- Bulk promotion wizard across academic sessions
- Examination masters (subjects, class-subject mapping with components,
  grade scales, versioned exam patterns)
- Teacher records + private document storage (Super Admin only)
- Global Activity Center (audit log) with human-readable summaries
- Settings (Super Admin editable): school profile, sessions, classes, sections,
  houses, fee heads, users/roles, system health
- Not linked in the sidebar: `/admissions` (Admission Register), `/attendance`
  (read-only viewer) and `/reports` (static list of planned reports)

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR on Cloudflare Workers via nitro) |
| Router | TanStack Router (file-based, `src/routes`) |
| Build | Vite 8 via `@lovable.dev/vite-tanstack-config` |
| Language | TypeScript 5.8 (strict) |
| Styling | Tailwind CSS v4 (`src/styles.css`, CSS variables / design tokens) |
| UI kit | shadcn/ui (new-york) + Radix primitives + lucide-react icons |
| Data/state | TanStack Query v5 |
| Forms | react-hook-form + zod (where used) |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Spreadsheets | `xlsx` (SheetJS) for import/template/export |
| Notifications | `sonner` toasts |
| Charts | `recharts` |

## Installation

```bash
bun install     # or npm install
```

Environment variables are provisioned automatically in `.env` (do not edit):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

## Running locally

```bash
bun run dev               # dev server on http://localhost:8080
bun run typecheck         # TypeScript (strict)
bun run lint              # eslint
bun run test              # vitest unit tests
bun run verify:migrations # migration linter (GRANT + RLS + policies)
bun run build             # production build
bun run build:dev         # development-mode build (used for verification)
bun run format            # prettier
```

Release verification runs all of the above; CI enforces it
(`.github/workflows/ci.yml`). See [DEPLOYMENT.md](./DEPLOYMENT.md).


## Folder structure

```
src/
  components/
    ui/                 shadcn/ui primitives (generated — avoid hand edits)
    app-sidebar.tsx     main navigation, role-aware
    page-header.tsx     shared page title/action header
    empty-state.tsx     shared empty placeholder
    fees/               fee tabs, opening-balance breakup dialog
    settings/           one component per Settings tab
    students/           student form, import, promote, fees tab, dialogs
    teachers/           teacher form and documents
  hooks/
    use-user-role.ts    role fetch + all permission booleans
    use-mobile.tsx
  integrations/supabase/  auto-generated client, types, auth middleware
  lib/
    permissions.ts      single source of truth for role capabilities
    date.ts             standardized date formatting
    activity.ts         fire-and-forget audit logging
    activity-format.ts  human-readable audit summaries
    fees-helpers.ts     fee constants, allocation priority, formatting
    opening-balance.ts  opening-balance breakup grouping/validation
    receipts.ts         receipt/void arithmetic
    promotion-helpers.ts session + class resolution for promotion
    students-helpers.ts student constants, storage upload, Excel import
    teachers-helpers.ts teacher constants, storage upload, masking
    invitations.functions.ts  server function for invitation-based onboarding
    __tests__/          vitest unit tests for the pure logic above
    error-capture.ts / error-page.ts / lovable-error-reporting.ts
    utils.ts            cn()
  services/             feature-scoped Supabase query modules
    users / invitations / fees / students

  routes/
    __root.tsx          app shell
    index.tsx           redirects to /dashboard
    auth.tsx            sign in (public sign-up disabled)
    _authenticated/     everything behind the auth gate
  router.tsx            router + QueryClient factory
  server.ts             SSR entry wrapper with error page fallback
  start.ts              server/function middleware registration
  styles.css            Tailwind v4 theme + design tokens
supabase/
  migrations/           timestamped SQL migrations (source of truth)
docs/                   this documentation
```

## Deployment

The app is deployed through Lovable (Publish). The build output targets a
Cloudflare Worker runtime (`nitro`), so server code must stay Worker-compatible
(no `child_process`, native binaries, or Node-only packages). The database,
auth, storage and secrets are managed by Lovable Cloud; there is no separate
backend service to deploy. Database changes ship as SQL migrations in
`supabase/migrations/`.
