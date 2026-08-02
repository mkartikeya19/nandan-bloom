# Contributing

Read [AI_CONTEXT.md](./AI_CONTEXT.md) first — it holds the conventions and the
do-not-change list. This file covers process.

## Ground rules

- The repository documentation in `/docs` is the **single source of truth**.
  A change is not done until the relevant doc is updated in the same commit.
- Core modules are **feature-frozen** after `v1.0.0`. Only production bug fixes
  ship in `v1.0.x`; new functionality targets `v1.1.0`.
- Business logic that is multi-step or authorization-sensitive belongs in
  Postgres, not in the client.

## Workflow

1. **Read.** Find the module in [MODULES.md](./MODULES.md), its rules in
   [BUSINESS_RULES.md](./BUSINESS_RULES.md), its data in
   [DATABASE.md](./DATABASE.md), and the end-to-end flow in
   [WORKFLOW.md](./WORKFLOW.md).
2. **Decide the layer.** Validation, atomicity and authorization → database.
   Presentation and interaction → route/component.
3. **Implement** using the existing helpers, services and UI primitives.
4. **Test.** Add or extend a unit test for any pure logic you touch.
5. **Verify.** `bun run verify:migrations && bun run typecheck && bun run lint &&
   bun run test && bun run build`.
6. **Document.** Update every affected file in `/docs`, plus
   [CHANGELOG.md](./CHANGELOG.md) under *Unreleased*.

## Commit and branch conventions

- Branch: `fix/<short-slug>` for v1.0.x bug fixes, `feat/<short-slug>` for
  v1.1.0 work.
- Commits: conventional style — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`, `db:` for migrations.
- One logical change per commit; migrations get their own commit.

## Code conventions (summary)

- TypeScript strict; no `any` unless wrapping an untyped RPC, with an
  `eslint-disable-next-line` comment.
- `@/` alias for everything under `src/`.
- Routes: flat file-based; a module with children uses `module.index.tsx`.
  Never introduce `students.tsx` / `fees.tsx` style layout files without an
  `<Outlet />`.
- UI: shadcn/ui from `@/components/ui/*`, `lucide-react` icons, `sonner` toasts.
- Colors come from design tokens in `src/styles.css` — never `text-white`,
  `bg-black` or `bg-[#hex]`.
- Money renders through `formatINR()`; dates through `src/lib/date.ts`.
- Data fetching: TanStack Query with descriptive array keys; invalidate after
  mutations.
- Supabase queries belong in `src/services/*`; pure rules belong in `src/lib/*`.
- Any user-triggered create/update/delete calls `logActivity()`.

## Database changes

One new timestamped migration per change, containing
`CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → policies (+ an
`updated_at` trigger). Never edit an applied migration. `bun run
verify:migrations` enforces this.

## Documentation validation checklist

Before opening a pull request:

- [ ] No references to routes or files that no longer exist
- [ ] Every internal link resolves to a file in `/docs`
- [ ] No placeholders, stale TODOs or "coming soon" claims about shipped work
- [ ] Planned features are labelled **Planned**, not described as implemented
- [ ] Mermaid diagrams match the current schema/routes
- [ ] Permission tables match `src/lib/permissions.ts`

## Review checklist

- [ ] UI check has a matching RLS/trigger/RPC check
- [ ] No role data outside `user_roles`
- [ ] No new delete path for `fee_payments`; corrections stay void-and-repost
- [ ] Partial payments still rejected
- [ ] May/June still excluded from tuition generation
- [ ] Storage buckets still private
- [ ] Worker-compatible dependencies only
