import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_ROLES } from "@/lib/permissions";

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().max(120).optional(),
  roles: z.array(z.enum(APP_ROLES)).min(1),
});

function generateTempPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const base = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");
  return `Nks#${base}9`;
}

/**
 * Invitation-only onboarding.
 *
 * Public sign-up is disabled at the auth provider, so a Super Admin creates the
 * account here. The `user_invitations` row is written first; the signup trigger
 * (`handle_new_user`) then assigns the invited roles and marks the invitation
 * accepted. The temporary password is returned once and never stored.
 */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Authorisation is re-checked in the database by `invite_user`, but fail fast here.
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin");
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRows || roleRows.length === 0) {
      throw new Error("Only Super Admins can invite users");
    }

    const { error: rpcErr } = await context.supabase.rpc("invite_user", {
      _email: data.email,
      _roles: data.roles,
      _full_name: data.fullName ?? null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tempPassword = generateTempPassword();
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName ?? null },
    });

    if (createErr) {
      // Account already exists — grant the invited roles directly instead.
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      const match = existing?.users?.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (!match) throw new Error(createErr.message);

      const { error: grantErr } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          data.roles.map((role) => ({ user_id: match.id, role })),
          { onConflict: "user_id,role" },
        );
      if (grantErr) throw new Error(grantErr.message);

      await supabaseAdmin
        .from("user_invitations")
        .update({ accepted_at: new Date().toISOString(), accepted_user_id: match.id })
        .eq("email", data.email)
        .is("accepted_at", null)
        .is("revoked_at", null);

      return { created: false as const, email: data.email, tempPassword: null };
    }

    return { created: true as const, email: data.email, tempPassword };
  });
