# Production Configuration

Required configuration for a production deployment of Nandan ERP v1.0.0.
Values marked **[manual]** live in the Cloud backend settings and cannot be
verified from this repository.

---

## 1. Authentication settings

| Setting | Required value | Why | Verified |
| --- | --- | --- | --- |
| Public sign-up | **Disabled** | Staff-only ERP; accounts are created by invitation. The app ships no sign-up UI. | [manual] |
| Email confirmation | Not relied upon | Invited accounts are created with `email_confirm: true` by the server function. | [manual] |
| Anonymous sign-in | **Disabled** | No anonymous surface exists in the app. | [manual] |
| Social providers | Not used | Sign-in is email + password only. | [manual] |
| Email sending (SMTP) | Not configured / not required | The ERP sends no email. Invitations show a one-time password on screen. | [manual] |
| Leaked-password protection (HIBP) | Recommended: **enabled** | Blocks known-breached passwords at signup/change. | [manual] |

## 2. Database

| Setting | Required | Notes |
| --- | --- | --- |
| RLS | Enabled on **every** `public` table | Verified 2 Aug 2026: all 32 public tables have RLS on with ≥1 policy. |
| Grants | Present per table | Enforced by `scripts/verify-migrations.mjs` in CI. |
| Migration mode | Append-only, forward-only | No down migrations exist. |
| Backups / PITR | Managed by the platform | Confirm the retention window meets the school's expectations. [manual] |

## 3. Storage

| Bucket | Visibility | Access |
| --- | --- | --- |
| `students` | **Private** | Read: all roles. Insert/update: Super Admin, Admin, Reception. Delete: Super Admin, Admin. |
| `teacher-documents` | **Private** | Read/write/update/delete: **Super Admin only**. |

Files are served exclusively via short-lived signed URLs. Never make a bucket
public.

## 4. Environment variables

Provisioned automatically by the platform in `.env` — do not edit:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Only publishable values reach the browser. Server-only values are read from
`process.env` **inside** server-function handlers. The service-role key and the
database password are not accessible in this hosting model and must never be
placed in application code.

## 5. Password policy

**Current implementation (v1.0.0):**

| Aspect | Status |
| --- | --- |
| Minimum length enforced by the UI | 6 characters (`minLength={6}` on the sign-in field) |
| Minimum length enforced by the provider | Provider default — **[manual]** confirm and raise if required |
| Invitation temporary password | Generated server-side from 12 cryptographically random bytes, shown **once**, never stored by the app |
| Forced change at first login | **Not implemented** |
| Self-service password change | **Not implemented** — no UI exists |
| Self-service password reset | **Not implemented** — no reset flow, and no SMTP configured |
| Complexity rules / rotation / lockout | Not implemented in the app; whatever the auth provider enforces applies |

**Operational consequence:** if a user forgets their password, a platform
administrator must reset it from the backend Authentication → Users screen and
communicate the new password out of band.

**Recommended policy until the gap is closed:** issue invitations one at a time,
deliver the temporary password over a private channel, and require the recipient
to sign in the same day.

**Backlog (targets v1.0.x / v1.1.0):** force password change on first login, a
self-service change-password screen, and — once SMTP is configured — a password
reset flow. See [ROADMAP.md](./ROADMAP.md).

## 6. Application configuration

| Item | Where | Notes |
| --- | --- | --- |
| School profile (name, address, contact) | Settings → School | Printed on receipts. |
| Academic session | Settings → Sessions | Exactly one may be `Active`; enforced by a partial unique index and a transition trigger. |
| Default collection mode | `fee_settings.default_collection_mode` | Quick Collect / Manual Allocation. |
| Fee heads & structures | Settings → Fee Heads, Fees → Structures | Admission is blocked without exactly one Active + Complete structure per session + class. |

## 7. Runtime constraints

The server runs on a Cloudflare Worker. No `child_process`, `sharp`, `canvas`,
`puppeteer`, `fs.watch` or native addons; everything is bundled at build time;
never set `ssr.external` / `resolve.external`. See [DEPLOYMENT.md](./DEPLOYMENT.md).
