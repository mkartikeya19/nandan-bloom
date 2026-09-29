import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260809173000_lifecycle_security_remediation.sql",
  "utf8",
);

describe("D1-D5 lifecycle remediation migration", () => {
  it("D1 restricts self-service profile fields and active-user policy checks", () => {
    expect(migration).toContain("GRANT UPDATE (full_name, phone, avatar_url)");
    expect(migration).not.toContain("phone, avatar_url, updated_at");
    expect(migration).toContain(
      "USING (auth.uid() = id AND public.is_user_active(auth.uid()))",
    );
    expect(migration).toContain(
      "WITH CHECK (auth.uid() = id AND public.is_user_active(auth.uid()))",
    );
  });

  it("D2 revokes anonymous execution from every SECURITY DEFINER function", () => {
    expect(migration).toContain("WHERE n.nspname = 'public' AND p.prosecdef");
    expect(migration).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon");
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_finalize_user_deletion(uuid) TO authenticated",
    );
  });

  it("D3 serializes all lifecycle mutations before state checks", () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtext('public.user_lifecycle'))");
    for (const name of ["admin_set_user_active", "admin_set_user_roles", "admin_delete_user"]) {
      const body = migration.split(`FUNCTION public.${name}`)[1]?.split("END $$;")[0] ?? "";
      expect(body).toContain("PERFORM public.lock_user_lifecycle();");
    }
  });

  it("D4 preserves deactivation attribution as a deletion blocker", () => {
    expect(migration).toContain("WHERE deactivated_by = _target_user_id");
    expect(migration).toContain("Deactivated other staff accounts");
  });

  it("D5 retains actor and email and finalizes the audit exactly once", () => {
    expect(migration).toContain("CREATE TABLE public.user_deletion_jobs");
    expect(migration).toContain("target_email text");
    expect(migration).toContain("requested_by uuid NOT NULL");
    const cleanup = migration
      .split("FUNCTION public.admin_delete_user")[1]
      ?.split("FUNCTION public.admin_finalize_user_deletion")[0];
    expect(cleanup).not.toContain("'Deleted user'");
    const finalize = migration.split("FUNCTION public.admin_finalize_user_deletion")[1] ?? "";
    expect(finalize).toContain("IF deletion_job.finalized_at IS NULL THEN");
    expect(finalize).toContain("deletion_job.requested_by");
    expect(finalize).toContain("deletion_job.target_email");
  });

  it("keeps last-Super-Admin and self-deletion protections server-side", () => {
    expect(migration).toContain("At least one active Super Admin must remain");
    const cleanup = migration.split("FUNCTION public.admin_delete_user")[1] ?? "";
    expect(cleanup).toContain("IF _target_user_id = uid THEN");
    expect(cleanup).toContain("You cannot delete your own account");
  });
});