-- 1) FK indexes on fee_payments (audit finding)
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON public.fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_academic_record_id ON public.fee_payments(academic_record_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_academic_session_id ON public.fee_payments(academic_session_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_payment_date ON public.fee_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_fee_payment_allocations_schedule_id ON public.fee_payment_allocations(student_fee_schedule_id);
CREATE INDEX IF NOT EXISTS idx_fee_payment_allocations_payment_id ON public.fee_payment_allocations(fee_payment_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_schedule_student ON public.student_fee_schedule(student_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_schedule_record ON public.student_fee_schedule(academic_record_id);
CREATE INDEX IF NOT EXISTS idx_sar_fee_structure_id ON public.student_academic_records(fee_structure_id);
CREATE INDEX IF NOT EXISTS idx_sar_student_id ON public.student_academic_records(student_id);

-- 2) Repair orphan Active academic records missing fee_structure_id
DO $$
DECLARE
  r record;
  fs_id uuid;
  matches int;
BEGIN
  FOR r IN
    SELECT id, academic_session_id, class_id
    FROM public.student_academic_records
    WHERE status = 'Active' AND fee_structure_id IS NULL
  LOOP
    SELECT structure_id, match_count INTO fs_id, matches
      FROM public.find_complete_fee_structure(r.academic_session_id, r.class_id);
    IF fs_id IS NOT NULL AND COALESCE(matches,0) = 1 THEN
      UPDATE public.student_academic_records
        SET fee_structure_id = fs_id, updated_at = now()
        WHERE id = r.id;
      PERFORM public.generate_student_fee_schedule(r.id);
      INSERT INTO public.activity_log (user_id, module, action, entity_type, entity_id, details)
      VALUES (NULL, 'Fees', 'Orphan Academic Record Repaired', 'student_academic_records', r.id,
              jsonb_build_object('fee_structure_id', fs_id, 'automatic', true));
    END IF;
  END LOOP;
END $$;

-- 3) Alphabetical roll number regenerator (per session + class)
CREATE OR REPLACE FUNCTION public.regenerate_class_roll_numbers(
  _academic_session_id uuid,
  _class_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  updated_count int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'super_admin') OR public.has_role(uid,'principal')) THEN
    RAISE EXCEPTION 'You do not have permission to regenerate roll numbers';
  END IF;

  WITH ordered AS (
    SELECT sar.id,
           ROW_NUMBER() OVER (ORDER BY UPPER(s.full_name), s.scholar_number) AS rn
    FROM public.student_academic_records sar
    JOIN public.students s ON s.id = sar.student_id
    WHERE sar.academic_session_id = _academic_session_id
      AND sar.class_id = _class_id
      AND sar.status = 'Active'
  )
  UPDATE public.student_academic_records sar
    SET roll_number = ordered.rn::text, updated_at = now()
    FROM ordered
    WHERE sar.id = ordered.id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.regenerate_class_roll_numbers(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_class_roll_numbers(uuid, uuid) TO authenticated;

-- 4) Regenerate roll numbers for every (session,class) that had promotions,
--    used after bulk_promote_students completes.
CREATE OR REPLACE FUNCTION public.regenerate_roll_numbers_after_promotion(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  itm jsonb;
  pair record;
  total int := 0;
  n int;
BEGIN
  FOR pair IN
    SELECT DISTINCT (i->>'new_session_id')::uuid AS s, (i->>'new_class_id')::uuid AS c
    FROM jsonb_array_elements(_payload->'items') i
    WHERE (i->>'action') = 'promote' OR (i->>'action') = 'retain'
  LOOP
    n := public.regenerate_class_roll_numbers(pair.s, pair.c);
    total := total + COALESCE(n,0);
  END LOOP;
  RETURN total;
END $$;

REVOKE EXECUTE ON FUNCTION public.regenerate_roll_numbers_after_promotion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_roll_numbers_after_promotion(jsonb) TO authenticated;

-- 5) Harden other SECURITY DEFINER RPCs (audit finding)
REVOKE EXECUTE ON FUNCTION public.bulk_promote_students(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_promote_students(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_student_fee_schedule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_student_fee_schedule(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.next_scholar_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_scholar_number() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO authenticated;