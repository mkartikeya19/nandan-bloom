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

/**
 * Hard-delete an account, fail-safe (D5).
 *
 * Supabase Auth and PostgreSQL cannot participate in one atomic transaction.
 * The sequence is therefore ordered so that every failure mode is safe:
 *
 *   1. verify the actor's session (middleware) and Super Admin rights (RPC),
 *   2. recompute delete eligibility immediately before starting,
 *   3. snapshot the target id + email,
 *   4. mark the target inactive in the application database,
 *   5. ban the Auth login and re-read the user to confirm the ban,
 *   6. only then remove the application rows (audited inside the RPC),
 *   7. delete the Auth user and confirm.
 *
 * If step 5 fails nothing is removed and the account is left as it was, apart
 * from being inactive. If step 6 or 7 fails the target stays inactive and
 * banned — access is never restored automatically — and an explicit
 * partial-failure is raised carrying the Auth user id so an authorised Super
 * Admin can retry. The RPC is idempotent, so a retry works even when the
 * application rows are already gone. Nothing here ever runs in the browser.
 */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 2. Recompute eligibility (also re-checks Super Admin authorisation).
    const { data: eligibility, error: eligErr } = await supabase.rpc("user_delete_eligibility", {
      _target_user_id: data.userId,
    });
    if (eligErr) throw new Error(eligErr.message);
    const elig = eligibility as unknown as DeleteEligibility | null;
    if (elig && !elig.deletable) {
      throw new Error("This account has operational history and cannot be deleted.");
    }

    // 3. Snapshot before anything destructive.
    const { data: snapshot } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("id", data.userId)
      .maybeSingle();
    const email = snapshot?.email ?? null;

    // 4. Inactive first. Tolerated when the profile is already gone (retry).
    const { error: deactivateErr } = await supabase.rpc("admin_set_user_active", {
      _target_user_id: data.userId,
      _active: false,
      _reason: "Pending permanent deletion",
    });
    if (deactivateErr && !/user not found/i.test(deactivateErr.message)) {
      throw new Error(deactivateErr.message);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 5. Ban, then verify the ban actually took effect.
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "876000h",
    });
    if (banErr) {
      throw new Error(`User Deletion Failed — could not disable the login: ${banErr.message}`);
    }
    const { data: banned, error: readErr } = await supabaseAdmin.auth.admin.getUserById(
      data.userId,
    );
    const bannedUntil = (banned?.user as { banned_until?: string } | undefined)?.banned_until;
    if (readErr || !bannedUntil) {
      throw new Error(
        "User Deletion Failed — the login could not be confirmed as disabled. No records were removed.",
      );
    }

    // 6. Remove application records (audited inside the RPC).
    const { error: rpcErr } = await supabase.rpc("admin_delete_user", {
      _target_user_id: data.userId,
    });
    if (rpcErr) {
      throw new Error(
        `User Deletion Failed — the login is disabled and the account stays inactive. ` +
          `Retry deletion for user ${data.userId}. Reason: ${rpcErr.message}`,
      );
    }

    // 7. Delete the Auth account. Only now may we report success.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) {
      throw new Error(
        `User Deletion Failed — application records were removed but the login still exists ` +
          `and remains disabled. Retry deletion for user ${data.userId}. Reason: ${delErr.message}`,
      );
    }

    return { userId: data.userId, email, deleted: true as const, state: "User Deleted" as const };
  });
