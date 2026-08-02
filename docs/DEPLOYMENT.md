# Deployment

## Where it runs

| Layer | Host |
| --- | --- |
| Web app (SSR + static assets) | Lovable hosting, Cloudflare Worker runtime (nitro build target) |
| Database, Auth, Storage | Lovable Cloud managed Postgres (Supabase) |
| Secrets / environment | Managed by the platform, injected at build/runtime |

There is **no separate backend service**. The browser talks to Postgres through
the Supabase JS client under RLS; multi-step logic runs as `SECURITY DEFINER`
functions in the database.

## Environment variables

Provisioned automatically in `.env` — **do not edit or commit changes**:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Only `VITE_*` values reach the browser, and only publishable values are exposed.
Server-only values are read from `process.env` **inside** server-function
handlers.

## Runtime constraints (Cloudflare Worker)

Server code must stay Worker-compatible:

- No `child_process`, `sharp`, `canvas`, `puppeteer`, `fs.watch`, `os.cpus()`.
- No native addons or packages requiring node-gyp / prebuild-install.
- Everything is bundled at build time; there is no runtime module resolution.
- Never set `ssr.external` / `resolve.external` in `vite.config.ts`.

If a package's README only documents desktop Node, do not add it.

## Commands

```bash
bun install              # dependencies
bun run dev              # local dev server on http://localhost:8080
bun run typecheck        # TypeScript, strict
bun run lint             # ESLint
bun run test             # Vitest
bun run verify:migrations# migration linter (GRANT + RLS + policies)
bun run build            # production build
bun run build:dev        # development-mode build used for verification
```

## Release checklist

Run every gate before tagging — all must pass:

1. `bun run verify:migrations`
2. `bun run typecheck`
3. `bun run lint`
4. `bun run test`
5. `bun run build`
6. Documentation validation: no stale routes, no broken internal links, diagrams
   match the implementation ([CONTRIBUTING.md](./CONTRIBUTING.md)).
7. Manual regression path in [TESTING.md](./TESTING.md).

Then publish from Lovable and tag the release:

```bash
git tag -a v1.0.0 -m "Nandan ERP v1.0.0 - Core ERP Foundation"
git push origin v1.0.0
```

## Database deployments

- Schema changes ship **only** as new timestamped files in
  `supabase/migrations/`. Migrations are append-only — never edit an applied one.
- Every new `public` table needs, in the same migration and in this order:
  `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → policies, plus an
  `updated_at` trigger.
- `src/integrations/supabase/types.ts` is regenerated after a migration is
  applied; never hand-edit it.
- There is no down-migration mechanism. A mistake is corrected by a new
  forward migration.

## Storage

Two private buckets, `students` and `teacher-documents`. Keep them private;
files are served exclusively through short-lived signed URLs.

## Post-deployment verification

1. Sign in and confirm the sidebar matches your role.
2. Open a student profile → Fees tab and confirm live ledger data loads.
3. Open a receipt and confirm the school name and totals render.
4. Check `/settings` → System Health for records missing a fee structure.
5. Check the Activity Center for entries from the smoke test.

## Rollback

Redeploy the previous published version from Lovable. Database migrations are
**not** rolled back automatically; because migrations are additive, the previous
app version normally runs against the newer schema — verify this before rolling
back, and ship a corrective migration if it does not.

## Operational notes

- Only one academic session may be `Active`; closing a session is a deliberate
  Settings action.
- Invitations issue a one-time temporary password shown once — there is no email
  delivery; share it out of band.
- Backups and point-in-time recovery are handled by the managed database
  platform.
