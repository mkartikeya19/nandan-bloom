CREATE TABLE public.migration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type text NOT NULL CHECK (batch_type IN ('students','opening_balances','teachers')),
  label text,
  record_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  rolled_back_at timestamptz,
  rolled_back_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.migration_batches TO authenticated;
GRANT ALL ON public.migration_batches TO service_role;
ALTER TABLE public.migration_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view migration batches" ON public.migration_batches
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can create migration batches" ON public.migration_batches
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can update migration batches" ON public.migration_batches
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.migration_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.migration_batches(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('student','student_academic_record','opening_balance_detail','teacher')),
  entity_id uuid NOT NULL,
  entity_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_migration_batch_items_batch ON public.migration_batch_items(batch_id);

GRANT SELECT, INSERT, DELETE ON public.migration_batch_items TO authenticated;
GRANT ALL ON public.migration_batch_items TO service_role;
ALTER TABLE public.migration_batch_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view migration batch items" ON public.migration_batch_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can create migration batch items" ON public.migration_batch_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can delete migration batch items" ON public.migration_batch_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER update_migration_batches_updated_at
  BEFORE UPDATE ON public.migration_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Go-live validation ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.go_live_validation()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  active_sessions int;
  active_students int;
  no_record int;
  multi_record int;
  no_structure int;
  no_schedule int;
  orphan_schedules int;
  dup_scholars int;
  dup_employees int;
  bad_opening int;
  checks jsonb := '[]'::jsonb;
  failures int := 0;

  PROCEDURE_DUMMY int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'super_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO active_sessions FROM public.academic_sessions WHERE status = 'Active';

  SELECT COUNT(*) INTO active_students FROM public.students WHERE status = 'Active';

  SELECT COUNT(*) INTO no_record
  FROM public.students s
  WHERE s.status = 'Active'
    AND NOT EXISTS (
      SELECT 1 FROM public.student_academic_records r
      JOIN public.academic_sessions ses ON ses.id = r.academic_session_id
      WHERE r.student_id = s.id AND r.status = 'Active' AND ses.status = 'Active');

  SELECT COUNT(*) INTO multi_record FROM (
    SELECT r.student_id
    FROM public.student_academic_records r
    JOIN public.academic_sessions ses ON ses.id = r.academic_session_id
    WHERE r.status = 'Active' AND ses.status = 'Active'
    GROUP BY r.student_id HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO no_structure
  FROM public.student_academic_records r
  JOIN public.academic_sessions ses ON ses.id = r.academic_session_id
  WHERE r.status = 'Active' AND ses.status = 'Active'
    AND (r.fee_structure_id IS NULL OR NOT public.is_fee_structure_complete(r.fee_structure_id));

  SELECT COUNT(*) INTO no_schedule
  FROM public.student_academic_records r
  JOIN public.academic_sessions ses ON ses.id = r.academic_session_id
  WHERE r.status = 'Active' AND ses.status = 'Active'
    AND NOT EXISTS (SELECT 1 FROM public.student_fee_schedule f WHERE f.academic_record_id = r.id);

  SELECT COUNT(*) INTO orphan_schedules
  FROM public.student_fee_schedule f
  WHERE NOT EXISTS (SELECT 1 FROM public.student_academic_records r WHERE r.id = f.academic_record_id)
     OR NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id = f.student_id);

  SELECT COUNT(*) INTO dup_scholars FROM (
    SELECT scholar_number FROM public.students GROUP BY scholar_number HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO dup_employees FROM (
    SELECT employee_code FROM public.teachers GROUP BY employee_code HAVING COUNT(*) > 1
  ) t;

  SELECT COUNT(*) INTO bad_opening
  FROM public.student_academic_records r
  WHERE r.opening_balance IS NOT NULL AND r.opening_balance < 0;

  checks := jsonb_build_array(
    jsonb_build_object('key','active_session','label','Exactly one Academic Session is Active','ok', active_sessions = 1, 'detail', active_sessions || ' active session(s)'),
    jsonb_build_object('key','one_record','label','Every active student has exactly one active academic record','ok', no_record = 0 AND multi_record = 0, 'detail', no_record || ' without a record, ' || multi_record || ' with duplicates'),
    jsonb_build_object('key','fee_structure','label','Every active student has a Complete Fee Structure','ok', no_structure = 0, 'detail', no_structure || ' record(s) missing a complete structure'),
    jsonb_build_object('key','fee_schedule','label','Every active student has a generated fee schedule','ok', no_schedule = 0, 'detail', no_schedule || ' record(s) with no schedule'),
    jsonb_build_object('key','orphans','label','No orphan fee schedules','ok', orphan_schedules = 0, 'detail', orphan_schedules || ' orphan row(s)'),
    jsonb_build_object('key','dup_scholar','label','No duplicate Scholar Numbers','ok', dup_scholars = 0, 'detail', dup_scholars || ' duplicate(s)'),
    jsonb_build_object('key','dup_employee','label','No duplicate Employee IDs','ok', dup_employees = 0, 'detail', dup_employees || ' duplicate(s)'),
    jsonb_build_object('key','opening_balance','label','No invalid Opening Balances','ok', bad_opening = 0, 'detail', bad_opening || ' negative balance(s)')
  );

  SELECT COUNT(*) INTO failures FROM jsonb_array_elements(checks) c WHERE (c->>'ok')::boolean = false;

  RETURN jsonb_build_object(
    'ready', failures = 0,
    'failures', failures,
    'active_students', active_students,
    'checks', checks,
    'generated_at', now()
  );
END $$;

-- Rollback ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rollback_migration_batch(_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  b record;
  latest uuid;
  blocking int;
  removed_students int := 0;
  removed_records int := 0;
  removed_ob int := 0;
  removed_teachers int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'super_admin')) THEN
    RAISE EXCEPTION 'Only Admin/Super Admin can roll back a migration batch';
  END IF;

  SELECT * INTO b FROM public.migration_batches WHERE id = _batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Migration batch not found'; END IF;
  IF b.rolled_back_at IS NOT NULL THEN RAISE EXCEPTION 'This batch has already been rolled back'; END IF;

  SELECT id INTO latest FROM public.migration_batches
    WHERE rolled_back_at IS NULL ORDER BY created_at DESC LIMIT 1;
  IF latest IS DISTINCT FROM _batch_id THEN
    RAISE EXCEPTION 'Only the most recent migration batch can be rolled back';
  END IF;

  SELECT
    (SELECT COUNT(*) FROM public.fee_payments p WHERE p.created_at > b.created_at)
  + (SELECT COUNT(*) FROM public.student_academic_records r WHERE r.created_at > b.created_at
       AND NOT EXISTS (SELECT 1 FROM public.migration_batch_items i WHERE i.batch_id = _batch_id AND i.entity_type = 'student_academic_record' AND i.entity_id = r.id))
  + (SELECT COUNT(*) FROM public.students s WHERE s.created_at > b.created_at
       AND NOT EXISTS (SELECT 1 FROM public.migration_batch_items i WHERE i.batch_id = _batch_id AND i.entity_type = 'student' AND i.entity_id = s.id))
  INTO blocking;

  IF blocking > 0 THEN
    RAISE EXCEPTION 'Cannot roll back: % operational transaction(s) occurred after this batch', blocking;
  END IF;

  DELETE FROM public.opening_balance_details d
    WHERE d.id IN (SELECT entity_id FROM public.migration_batch_items WHERE batch_id = _batch_id AND entity_type = 'opening_balance_detail');
  GET DIAGNOSTICS removed_ob = ROW_COUNT;

  DELETE FROM public.student_fee_schedule f
    WHERE f.academic_record_id IN (SELECT entity_id FROM public.migration_batch_items WHERE batch_id = _batch_id AND entity_type = 'student_academic_record');

  DELETE FROM public.student_academic_records r
    WHERE r.id IN (SELECT entity_id FROM public.migration_batch_items WHERE batch_id = _batch_id AND entity_type = 'student_academic_record');
  GET DIAGNOSTICS removed_records = ROW_COUNT;

  DELETE FROM public.students s
    WHERE s.id IN (SELECT entity_id FROM public.migration_batch_items WHERE batch_id = _batch_id AND entity_type = 'student');
  GET DIAGNOSTICS removed_students = ROW_COUNT;

  DELETE FROM public.teachers t
    WHERE t.id IN (SELECT entity_id FROM public.migration_batch_items WHERE batch_id = _batch_id AND entity_type = 'teacher');
  GET DIAGNOSTICS removed_teachers = ROW_COUNT;

  UPDATE public.migration_batches
    SET rolled_back_at = now(), rolled_back_by = uid
    WHERE id = _batch_id;

  RETURN jsonb_build_object(
    'batch_id', _batch_id,
    'students_removed', removed_students,
    'academic_records_removed', removed_records,
    'opening_balances_removed', removed_ob,
    'teachers_removed', removed_teachers
  );
END $$;