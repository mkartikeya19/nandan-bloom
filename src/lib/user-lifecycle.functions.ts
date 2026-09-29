import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_ROLES } from "@/lib/permissions";
import { executeUserDeletion } from "@/lib/user-deletion";

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
 *   3. inspect Auth state for a new operation or retry,
 *   4. ban the Auth login and re-read the user to confirm the ban,
 *   5. remove application rows while durably preserving actor + email,
 *   6. delete the Auth user,
 *   7. write exactly one final audit event through a service-only RPC.
 *
 * If the ban fails, no application state changes. A later failure leaves the
 * target banned and the durable deletion job makes retries safe even after the
 * profile is gone. Nothing here ever runs in the browser.
 */
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => targetSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await executeUserDeletion({
      checkEligibility: async () => {
        const { data: eligibility, error } = await supabase.rpc("user_delete_eligibility", {
          _target_user_id: data.userId,
        });
        if (error) throw new Error(error.message);
        const result = eligibility as unknown as DeleteEligibility | null;
        return { deletable: result?.deletable ?? false };
      },
      getAuthUserState: async () => {
        const { data: authData, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
        if (error) {
          const status = (error as { status?: number }).status;
          if (status === 404) return { exists: false, banned: false };
          throw new Error(`User Deletion Failed — could not inspect the login: ${error.message}`);
        }
        return { exists: Boolean(authData.user), banned: Boolean(authData.user?.banned_until) };
      },
      banAuthUser: async () => {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
          ban_duration: "876000h",
        });
        if (error) {
          throw new Error(`User Deletion Failed — could not disable the login: ${error.message}`);
        }
      },
      cleanupApplicationRecords: async () => {
        const { data: cleanup, error } = await supabase.rpc("admin_delete_user", {
          _target_user_id: data.userId,
        });
        if (error) {
          throw new Error(
            `User Deletion Failed — the login is disabled and the account stays inactive. ` +
              `Retry deletion for user ${data.userId}. Reason: ${error.message}`,
          );
        }
        const payload = cleanup as { email?: string | null } | null;
        return { email: payload?.email ?? null };
      },
      deleteAuthUser: async () => {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
        if (error) {
          throw new Error(
            `User Deletion Failed — application records were removed but the login still exists ` +
              `and remains disabled. Retry deletion for user ${data.userId}. Reason: ${error.message}`,
          );
        }
      },
      finalizeDeletionAudit: async () => {
        const rpc = supabaseAdmin.rpc as unknown as (
          fn: "admin_finalize_user_deletion",
          args: { _target_user_id: string },
        ) => Promise<{ error: { message: string } | null }>;
        const { error } = await rpc("admin_finalize_user_deletion", {
          _target_user_id: data.userId,
        });
        if (error) {
          throw new Error(
            `User Deletion Failed — the login was deleted but final audit recording failed. ` +
              `Retry deletion for user ${data.userId}. Reason: ${error.message}`,
          );
        }
      },
    });

    return { userId: data.userId, ...result };
  });
