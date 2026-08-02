# BOOTSTRAP — First-time deployment & first Super Admin

This document describes the **one-time** procedure for standing up a fresh
Nandan ERP environment. It is written for the operator performing the
deployment, not for developers.

> Legend used throughout: **[repo]** = verifiable from this repository ·
> **[manual]** = must be performed/verified by an operator in the Lovable /
> Cloud backend settings.

---

## 1. Fresh installation

| #   | Step                          | How                                                                                                                                                                                                                                                                                      | Type                                                  |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Deploy the application        | Publish the project from Lovable. Frontend changes go live on publish; backend changes deploy immediately.                                                                                                                                                                               | [manual]                                              |
| 2   | Apply all database migrations | Migrations in `supabase/migrations/` are applied through the platform migration flow, in filename (timestamp) order. Never edit an applied migration.                                                                                                                                    | [manual]                                              |
| 3   | Verify migration success      | Run `bun run verify:migrations` in the repo (structural lint: GRANT + RLS + policy per new public table), then confirm in the backend that the expected tables exist.                                                                                                                    | [repo] + [manual]                                     |
| 4   | Configure storage buckets     | Two **private** buckets are required: `students` and `teacher-documents`. Both already exist in the current environment. Bucket access policies ship in migrations (`students bucket read/insert/update/delete`, `Super admins … teacher documents`). Buckets must never be made public. | [repo] policies, [manual] bucket existence/visibility |
| 5   | Configure SMTP                | **Not configured and not required by the application.** The ERP sends no email: invitations issue a one-time password shown on screen. If email confirmation or password-reset email is ever enabled, SMTP must be configured first.                                                     | [manual]                                              |
| 6   | Environment variables         | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` are provisioned automatically in `.env` by the platform. Do not edit or commit changes. Server-only values are read from `process.env` inside server-function handlers.                                 | [repo] names, [manual] values                         |

---

## 2. First Super Admin bootstrap

Public sign-up is disabled, so the very first account cannot be self-created
from the app. The sequence is:

| #   | Action                                                                   | Who                                           | Where                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Create the first Authentication user (email + password, email confirmed) | The deployment owner / platform administrator | Backend **Authentication → Users** (Cloud backend user management UI). This is the only account ever created outside the invitation flow.                                                                                                     |
| 2   | Sign in to the ERP with that account                                     | Same person                                   | `/auth` in the deployed app                                                                                                                                                                                                                   |
| 3   | Claim the admin role                                                     | Same person                                   | The Dashboard shows a **“Claim admin role”** banner while no `super_admin` exists. Clicking it calls the `claim_first_admin()` RPC, which grants the signed-in user both `admin` and `super_admin`.                                           |
| 4   | Verify                                                                   | Same person                                   | Reload the app: the sidebar must show **Settings** and **Teachers** (Super Admin only). In Settings → Users the account must list roles _Super Admin_ and _Admin_.                                                                            |
| 5   | Confirm public sign-up is disabled                                       | Deployment owner                              | Backend auth settings — sign-up must be **off**. The app has no sign-up UI (`/auth` offers sign-in only).                                                                                                                                     |
| 6   | Begin invitation-only onboarding                                         | Super Admin                                   | Settings → Users → **Invite user**: enter email, optional full name, and one or more roles. The account is created server-side and a **one-time temporary password is displayed once**. Share it out of band; it is never stored or re-shown. |

### Guarantees and limits of `claim_first_admin()`

- It is a `SECURITY DEFINER` function that **returns `false` and grants nothing**
  once any `super_admin` exists. It cannot be used to escalate later. [repo]
- It requires an authenticated session (`auth.uid()`); it cannot be called
  anonymously. [repo]

### After bootstrap

- Every subsequent account is created through **Settings → Users → Invite**.
- Roles are granted automatically on first sign-in by the `handle_new_user`
  trigger, which matches the new user's email to a pending, unexpired,
  unrevoked row in `user_invitations`.
- Roles live only in `user_roles` — never on `profiles` or `students`.

### Known limitation — first-login password change

The temporary password issued at invitation is **not** forced to be changed at
first login, and the app exposes no password-change or password-reset screen.
See [PRODUCTION_CONFIGURATION.md](./PRODUCTION_CONFIGURATION.md#5-password-policy)
for the full statement and the backlog item.

---

## 3. Minimum operational data before real use

Configure in this order (Settings, Super Admin):

1. **School profile** — name, address, contact (used on receipts).
2. **Academic session** — create and set exactly one session to _Active_.
3. **Classes**, then **Sections** per class, then **Houses** (optional).
4. **Fee heads** — frequency, applicable months, auto-generate, charge trigger,
   mandatory flag.
5. **Fee structures** — one per session + class; each must reach **Complete**
   (all active mandatory heads priced) or admission into that class is blocked.
6. **Students** — manual admission or Excel import.
7. **Opening balances** — `/fees/import` (manual entry or bulk Excel).

Related: [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) ·
[DEPLOYMENT.md](./DEPLOYMENT.md) · [SECURITY.md](./SECURITY.md)
