# Nandan Kids School ERP — Documentation

Internal ERP for **Nandan Kids Higher Secondary School**. Staff-only web application
covering student records, admissions register, fee management, promotions,
examination masters, teacher HR records and an audit/activity log.

> This documentation describes the **current implementation only**. Anything not
> listed here is not built.

## Documentation index

| File | Contents |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | App architecture, routing, auth, state, component layout |
| [DATABASE.md](./DATABASE.md) | Tables, columns, enums, relationships, RPCs, triggers, migrations |
| [MODULES.md](./MODULES.md) | Every implemented module, screens, permissions |
| [BUSINESS_RULES.md](./BUSINESS_RULES.md) | Rules enforced in code and in the database |
| [API.md](./API.md) | RPCs, storage APIs, helper/service utilities |
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
- Settings: school profile, sessions, classes, sections, houses, fee heads,
  users/roles, system health

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
bun run dev        # dev server on http://localhost:8080
bun run build      # production build
bun run build:dev  # development-mode build (used for verification)
bun run lint       # eslint
bun run format     # prettier
```

Type checking: `tsgo` / `tsc --noEmit` against `tsconfig.json`.

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
    activity.ts         fire-and-forget audit logging
    activity-format.ts  human-readable audit summaries
    fees-helpers.ts     fee constants, allocation priority, formatting
    students-helpers.ts student constants, storage upload, Excel import
    teachers-helpers.ts teacher constants, storage upload, masking
    error-capture.ts / error-page.ts / lovable-error-reporting.ts
    utils.ts            cn()
  routes/
    __root.tsx          app shell
    index.tsx           redirects to /dashboard
    auth.tsx            sign in / sign up
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
