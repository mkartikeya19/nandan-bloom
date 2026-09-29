-- Forward-only remediation of security defects D1-D5 found in the
-- user-lifecycle audit. Validate in an isolated non-production project before
-- applying to production.
-- D1  profiles privilege escalation (self-reactivation)
-- D2  EXECUTE grants on lifecycle functions
-- D3  last-active-Super-Admin race condition
-- D4  profiles.deactivated_by attribution blocks hard delete
-- +   self-scoped policies now respect deactivation

-- ---------------------------------------------------------------------------
-- D1. Column-level UPDATE privileges on public.profiles
-- ---------------------------------------------------------------------------
-- Lifecycle/security columns (is_active, deactivated_at, deactivated_by,
-- deactivation_reason) must never be writable through PostgREST by an
-- authenticated user, even on their own row. They are written exclusively by
-- the SECURITY DEFINER functions below, which run as the function owner and are
-- therefore unaffected by these grants.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND public.is_user_active(auth.uid()))
  WITH CHECK (auth.uid() = id AND public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles super_admin update" ON public.profiles;
CREATE POLICY "profiles super_admin update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ---------------------------------------------------------------------------
-- Self-scoped policies must respect deactivation
-- ---------------------------------------------------------------------------
-- Documented exception: "Users read own profile" stays open to the owner so a
-- deactivated session can still discover is_active = false and sign itself out.
-- It exposes only the caller's own row and no ERP data. First-Super-Admin
-- bootstrap (claim_first_admin) and invitation onboarding (handle_new_user) are
-- SECURITY DEFINER and unaffected; new accounts default to is_active = true.
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "read own activity" ON public.activity_log;
CREATE POLICY "read own activity" ON public.activity_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "insert own activity" ON public.activity_log;
CREATE POLICY "insert own activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_user_active(auth.uid()));

-- ---------------------------------------------------------------------------
-- D5. Durable deletion snapshot and idempotent finalisation state
-- ---------------------------------------------------------------------------
-- This internal table survives removal of profiles/user_roles. It preserves the
-- original acting Super Admin and target email across a failed Auth deletion so
-- a later retry can produce one accurate final audit event.
CREATE TABLE public.user_deletion_jobs (
  target_user_id uuid PRIMARY KEY,
  target_email text,
  requested_by uuid NOT NULL,
  application_records_removed_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

GRANT ALL ON public.user_deletion_jobs TO service_role;

ALTER TABLE public.user_deletion_jobs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- D3. Serialise every operation that can reduce the active Super Admin count
-- ---------------------------------------------------------------------------
-- All three mutating lifecycle functions take the SAME transaction-scoped
-- advisory lock, with the same single key, before counting. One key means one
-- lock order, so deadlock is impossible. The active-Super-Admin count is always
-- recomputed AFTER the lock is held and inside the same transaction as the
-- mutation.
CREATE OR REPLACE FUNCTION public.lock_user_lifecycle()
RETURNS void
LANGUAGE sql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pg_advisory_xact_lock(hashtext('public.user_lifecycle'));
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_active(_target_user_id uuid, _active boolean, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  remaining int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admins can change account status';
  END IF;
  IF _target_user_id = uid AND _active = false THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  PERFORM public.lock_user_lifecycle();

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _active = false THEN
    SELECT COUNT(*) INTO remaining
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'super_admin' AND p.is_active = true AND ur.user_id <> _target_user_id;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'super_admin')
       AND remaining = 0 THEN
      RAISE EXCEPTION 'At least one active Super Admin must remain';
    END IF;
  END IF;

  UPDATE public.profiles
     SET is_active = _active,
         deactivated_at = CASE WHEN _active THEN NULL ELSE now() END,
         deactivated_by = CASE WHEN _active THEN NULL ELSE uid END,
         deactivation_reason = CASE WHEN _active THEN NULL ELSE NULLIF(btrim(COALESCE(_reason,'')),'') END,
         updated_at = now()
   WHERE id = _target_user_id;

  INSERT INTO public.activity_log (user_id, module, action, entity_type, entity_id, details)
  VALUES (uid, 'Users', CASE WHEN _active THEN 'Reactivated user' ELSE 'Deactivated user' END,
          'user', _target_user_id::text,
          jsonb_build_object('reason', NULLIF(btrim(COALESCE(_reason,'')),''), 'is_active', _active));

  RETURN jsonb_build_object('user_id', _target_user_id, 'is_active', _active);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_roles(_target_user_id uuid, _roles app_role[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  remaining int;
  had_super boolean;
  keeps_super boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admins can change roles';
  END IF;

  PERFORM public.lock_user_lifecycle();

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  had_super := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'super_admin');
  keeps_super := 'super_admin' = ANY (COALESCE(_roles, ARRAY[]::app_role[]));

  IF had_super AND NOT keeps_super THEN
    IF _target_user_id = uid THEN
      RAISE EXCEPTION 'You cannot remove your own Super Admin role';
    END IF;
    SELECT COUNT(*) INTO remaining
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'super_admin' AND p.is_active = true AND ur.user_id <> _target_user_id;
    IF remaining = 0 THEN
      RAISE EXCEPTION 'At least one active Super Admin must remain';
    END IF;
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = _target_user_id
     AND NOT (role = ANY (COALESCE(_roles, ARRAY[]::app_role[])));

  INSERT INTO public.user_roles (user_id, role)
  SELECT _target_user_id, r FROM unnest(COALESCE(_roles, ARRAY[]::app_role[])) r
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.activity_log (user_id, module, action, entity_type, entity_id, details)
  VALUES (uid, 'Users', 'Updated user roles', 'user', _target_user_id::text,
          jsonb_build_object('roles', to_jsonb(COALESCE(_roles, ARRAY[]::app_role[]))));

  RETURN jsonb_build_object('user_id', _target_user_id, 'roles', to_jsonb(COALESCE(_roles, ARRAY[]::app_role[])));
END $$;

-- ---------------------------------------------------------------------------
-- D4. deactivated_by attribution blocks hard delete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_delete_eligibility(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  blockers jsonb := '[]'::jsonb;
  n int;
  remaining int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admins can review account deletion';
  END IF;

  IF _target_user_id = uid THEN
    blockers := blockers || jsonb_build_object('label', 'You cannot delete your own account', 'count', 1);
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'super_admin') THEN
    SELECT COUNT(*) INTO remaining
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'super_admin' AND p.is_active = true AND ur.user_id <> _target_user_id;
    IF remaining = 0 THEN
      blockers := blockers || jsonb_build_object('label', 'At least one active Super Admin must remain', 'count', 1);
    END IF;
  END IF;

  SELECT COUNT(*) INTO n FROM public.fee_payments WHERE collected_by = _target_user_id OR voided_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Fee receipts collected or voided', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.attendance WHERE marked_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Attendance records marked', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.fee_concessions WHERE approved_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Fee concessions approved', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.migration_batches WHERE created_by = _target_user_id OR rolled_back_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Data migration batches', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.opening_balance_details WHERE created_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Opening balance entries', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.exam_patterns WHERE created_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Examination patterns created', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.academic_sessions WHERE closed_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Academic sessions closed', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.teachers WHERE user_id = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Linked teacher record', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.teacher_documents WHERE uploaded_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Teacher documents uploaded', 'count', n); END IF;

  SELECT COUNT(*) INTO n FROM public.user_invitations WHERE invited_by = _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Invitations sent to other staff', 'count', n); END IF;

  -- D4: attribution of another account's deactivation must be preserved.
  SELECT COUNT(*) INTO n FROM public.profiles
   WHERE deactivated_by = _target_user_id AND id <> _target_user_id;
  IF n > 0 THEN blockers := blockers || jsonb_build_object('label', 'Deactivated other staff accounts', 'count', n); END IF;

  RETURN jsonb_build_object(
    'user_id', _target_user_id,
    'deletable', jsonb_array_length(blockers) = 0,
    'blockers', blockers
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  eligibility jsonb;
  target_email text;
  deletion_job public.user_deletion_jobs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admins can delete accounts';
  END IF;
  IF _target_user_id = uid THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  PERFORM public.lock_user_lifecycle();

  SELECT * INTO deletion_job
  FROM public.user_deletion_jobs
  WHERE target_user_id = _target_user_id;

  -- Retry-safe after application cleanup: the durable job retains both the
  -- original email and acting Super Admin attribution.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    IF deletion_job.target_user_id IS NULL THEN
      RAISE EXCEPTION 'Deletion state not found';
    END IF;
    RETURN jsonb_build_object('user_id', _target_user_id,
                              'email', deletion_job.target_email,
                              'deleted', true, 'already_removed', true);
  END IF;

  SELECT email INTO target_email FROM public.profiles WHERE id = _target_user_id;

  eligibility := public.user_delete_eligibility(_target_user_id);
  IF NOT (eligibility->>'deletable')::boolean THEN
    RAISE EXCEPTION 'This account has operational history and cannot be deleted. Deactivate it instead.';
  END IF;

  INSERT INTO public.user_deletion_jobs (target_user_id, target_email, requested_by)
  VALUES (_target_user_id, target_email, uid)
  ON CONFLICT (target_user_id) DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  UPDATE public.user_invitations SET accepted_user_id = NULL WHERE accepted_user_id = _target_user_id;
  DELETE FROM public.profiles WHERE id = _target_user_id;

  RETURN jsonb_build_object('user_id', _target_user_id, 'email', target_email, 'deleted', true);
END $$;

-- Service-only finalisation. The server calls this only after Auth deletion has
-- succeeded. Row locking plus finalized_at makes concurrent/repeated retries
-- idempotent and guarantees exactly one final "Deleted user" event.
CREATE OR REPLACE FUNCTION public.admin_finalize_user_deletion(_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deletion_job public.user_deletion_jobs%ROWTYPE;
BEGIN
  SELECT * INTO deletion_job
  FROM public.user_deletion_jobs
  WHERE target_user_id = _target_user_id
  FOR UPDATE;

  IF deletion_job.target_user_id IS NULL THEN
    RAISE EXCEPTION 'Deletion state not found';
  END IF;

  IF deletion_job.finalized_at IS NULL THEN
    INSERT INTO public.activity_log (user_id, module, action, entity_type, entity_id, details)
    VALUES (deletion_job.requested_by, 'Users', 'Deleted user', 'user',
            _target_user_id::text,
            jsonb_build_object('email', deletion_job.target_email));

    UPDATE public.user_deletion_jobs
    SET finalized_at = now()
    WHERE target_user_id = _target_user_id;
  END IF;

  RETURN jsonb_build_object('user_id', _target_user_id,
                            'email', deletion_job.target_email,
                            'finalized', true,
                            'already_finalized', deletion_job.finalized_at IS NOT NULL);
END $$;

-- ---------------------------------------------------------------------------
-- D2. EXECUTE grants - least privilege for all SECURITY DEFINER functions
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

-- RLS helpers must be callable while policies run as authenticated users.
GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Administrative RPCs are exposed only to authenticated users and enforce the
-- Super Admin role internally. The post-Auth finalizer is deliberately omitted.
GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_roles(uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_delete_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Internal helper and finalizer are server-only.
GRANT EXECUTE ON FUNCTION public.lock_user_lifecycle() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_finalize_user_deletion(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Verification queries (run manually against the non-production database)
-- ---------------------------------------------------------------------------
-- 1. Column privileges on profiles
--   SELECT grantee, privilege_type, column_name
--     FROM information_schema.column_privileges
--    WHERE table_schema='public' AND table_name='profiles' AND privilege_type='UPDATE'
--    ORDER BY grantee, column_name;
--   Expected for authenticated: full_name, phone, avatar_url only.
--
-- 2. Function privileges
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.proacl
--     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public'
--      AND p.proname IN ('is_user_active','has_role','admin_set_user_active',
--                        'admin_set_user_roles','user_delete_eligibility',
--                        'admin_delete_user','admin_finalize_user_deletion',
--                        'lock_user_lifecycle');
--   Expected: no "=X/" (PUBLIC) and no anon entry in proacl.
--
-- 3. Accidental anon execution anywhere in public
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE');
