import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_ROLES } from "@/lib/permissions";

/**
 * Super Admin user-lifecycle operations.
 *
 * Every rule (Super Admin only, no self-deactivation, no self-demotion, at
 * least one active Super Admin, no deletion of accounts with operational
 * history) is enforced inside SECURITY DEFINER database functions, which also
 * write the audit entry. These server functions add the auth-provider side
 * (blocking sign-in, deleting the login) that SQL cannot reach.
 */

const targetSchema = z.object({ userId: z.string().uuid() });

const setActiveSchema = targetSchema.extend({
  active: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

const setRolesSchema = targetSchema.extend({
  roles: z.array(z.enum(APP_ROLES)),
});

export interface DeleteEligibility {
  user_id: string;
  deletable: boolean;
  blockers: { label: string; count: number }[];
}

/** Deactivate or reactivate a staff account. */
export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setActiveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_user_active", {
      _target_user_id: data.userId,
      _active: data.active,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);

    // Database access is already denied the moment the profile flips inactive
    // (`has_role` and every read policy check it). Banning additionally stops
    // the account from obtaining a fresh token.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (banErr) throw new Error(banErr.message);

    return { userId: data.userId, active: data.active };
  });

/** Replace a user's role set in one audited operation. */
export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => setRolesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_user_roles", {
      _target_user_id: data.userId,
      _roles: data.roles,
    });
    if (error) throw new Error(error.message);
    return { userId: data.userId, roles: data.roles };
  });

/** Report whether an account can be hard-deleted, and what is blocking it. */
export const checkUserDeletable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("user_delete_eligibility", {
      _target_user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    return result as unknown as DeleteEligibility;
  });

/** Hard-delete an account. Refused by the database when history exists. */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_delete_user", {
      _target_user_id: data.userId,
    });
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);

    return { userId: data.userId, deleted: true as const };
  });
