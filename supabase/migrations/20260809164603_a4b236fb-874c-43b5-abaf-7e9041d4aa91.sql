-- 1. Activation state on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

-- 2. Central activity gate
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND COALESCE((SELECT p.is_active FROM public.profiles p WHERE p.id = _user_id), true);
$$;

GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated;

-- 3. Deactivated users hold no roles anywhere (RLS + every SECURITY DEFINER RPC)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
     AND COALESCE((SELECT p.is_active FROM public.profiles p WHERE p.id = _user_id), true)
$$;

-- 4. Blanket authenticated-read policies must also respect deactivation
DROP POLICY IF EXISTS "academic_sessions select" ON public.academic_sessions;
CREATE POLICY "academic_sessions select" ON public.academic_sessions FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read attendance" ON public.attendance;
CREATE POLICY "Authenticated read attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view components" ON public.exam_class_subject_components;
CREATE POLICY "Staff can view components" ON public.exam_class_subject_components FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view class subjects" ON public.exam_class_subjects;
CREATE POLICY "Staff can view class subjects" ON public.exam_class_subjects FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view bands" ON public.exam_grade_bands;
CREATE POLICY "Staff can view bands" ON public.exam_grade_bands FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view scales" ON public.exam_grade_scales;
CREATE POLICY "Staff can view scales" ON public.exam_grade_scales FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view pattern classes" ON public.exam_pattern_classes;
CREATE POLICY "Staff can view pattern classes" ON public.exam_pattern_classes FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view pattern terms" ON public.exam_pattern_terms;
CREATE POLICY "Staff can view pattern terms" ON public.exam_pattern_terms FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view patterns" ON public.exam_patterns;
CREATE POLICY "Staff can view patterns" ON public.exam_patterns FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Staff can view exam subjects" ON public.exam_subjects;
CREATE POLICY "Staff can view exam subjects" ON public.exam_subjects FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "fee_heads select" ON public.fee_heads;
CREATE POLICY "fee_heads select" ON public.fee_heads FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "fee_settings select" ON public.fee_settings;
CREATE POLICY "fee_settings select" ON public.fee_settings FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "fee_structure_items select" ON public.fee_structure_items;
CREATE POLICY "fee_structure_items select" ON public.fee_structure_items FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read fee_structures" ON public.fee_structures;
CREATE POLICY "Authenticated read fee_structures" ON public.fee_structures FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "houses select" ON public.houses;
CREATE POLICY "houses select" ON public.houses FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "school_classes select" ON public.school_classes;
CREATE POLICY "school_classes select" ON public.school_classes FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "school_profile select" ON public.school_profile;
CREATE POLICY "school_profile select" ON public.school_profile FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

DROP POLICY IF EXISTS "school_sections select" ON public.school_sections;
CREATE POLICY "school_sections select" ON public.school_sections FOR SELECT TO authenticated USING (public.is_user_active(auth.uid()));

-- 5. Super Admin lifecycle operations (audited, self-protecting)
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

GRANT EXECUTE ON FUNCTION public.admin_set_user_active(uuid, boolean, text) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.admin_set_user_roles(uuid, app_role[]) TO authenticated;

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

  RETURN jsonb_build_object(
    'user_id', _target_user_id,
    'deletable', jsonb_array_length(blockers) = 0,
    'blockers', blockers
  );
END $$;

GRANT EXECUTE ON FUNCTION public.user_delete_eligibility(uuid) TO authenticated;

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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admins can delete accounts';
  END IF;

  eligibility := public.user_delete_eligibility(_target_user_id);
  IF NOT (eligibility->>'deletable')::boolean THEN
    RAISE EXCEPTION 'This account has operational history and cannot be deleted. Deactivate it instead.';
  END IF;

  SELECT email INTO target_email FROM public.profiles WHERE id = _target_user_id;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  UPDATE public.user_invitations SET accepted_user_id = NULL WHERE accepted_user_id = _target_user_id;
  DELETE FROM public.profiles WHERE id = _target_user_id;

  INSERT INTO public.activity_log (user_id, module, action, entity_type, entity_id, details)
  VALUES (uid, 'Users', 'Deleted user', 'user', _target_user_id::text,
          jsonb_build_object('email', target_email));

  RETURN jsonb_build_object('user_id', _target_user_id, 'email', target_email, 'deleted', true);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;