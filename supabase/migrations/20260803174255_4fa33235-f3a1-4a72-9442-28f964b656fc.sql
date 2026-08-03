-- 1. Role-scoped SELECT policies

DROP POLICY IF EXISTS "Authenticated read students" ON public.students;
CREATE POLICY "Staff can view students" ON public.students FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
  OR public.has_role(auth.uid(),'teacher')
);

DROP POLICY IF EXISTS "Authenticated can view academic records" ON public.student_academic_records;
CREATE POLICY "Staff can view academic records" ON public.student_academic_records FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
  OR public.has_role(auth.uid(),'teacher')
);

DROP POLICY IF EXISTS "Authenticated read admissions" ON public.admissions;
CREATE POLICY "Office staff can view admissions" ON public.admissions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
);

DROP POLICY IF EXISTS "fee_payments select" ON public.fee_payments;
CREATE POLICY "Finance staff can view fee payments" ON public.fee_payments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
);

DROP POLICY IF EXISTS "fpa select" ON public.fee_payment_allocations;
CREATE POLICY "Finance staff can view payment allocations" ON public.fee_payment_allocations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
);

DROP POLICY IF EXISTS "sfs select" ON public.student_fee_schedule;
CREATE POLICY "Finance staff can view fee schedule" ON public.student_fee_schedule FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
);

DROP POLICY IF EXISTS "fee_concessions select" ON public.fee_concessions;
CREATE POLICY "Finance staff can view concessions" ON public.fee_concessions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
);

DROP POLICY IF EXISTS "Authenticated with a role can view opening balance details" ON public.opening_balance_details;
CREATE POLICY "Finance staff can view opening balance details" ON public.opening_balance_details FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
);

-- 2. Storage: tie student files to an existing student record

DROP POLICY IF EXISTS "students bucket read" ON storage.objects;
CREATE POLICY "students bucket read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'students'
  AND (storage.foldername(name))[1] IN ('photos','documents')
  AND EXISTS (SELECT 1 FROM public.students s WHERE s.scholar_number = (storage.foldername(name))[2])
  AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception') OR public.has_role(auth.uid(),'principal')
    OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'staff')
  )
);

DROP POLICY IF EXISTS "students bucket insert" ON storage.objects;
CREATE POLICY "students bucket insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'students'
  AND (storage.foldername(name))[1] IN ('photos','documents')
  AND EXISTS (SELECT 1 FROM public.students s WHERE s.scholar_number = (storage.foldername(name))[2])
  AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  )
);

DROP POLICY IF EXISTS "students bucket update" ON storage.objects;
CREATE POLICY "students bucket update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'students'
  AND EXISTS (SELECT 1 FROM public.students s WHERE s.scholar_number = (storage.foldername(name))[2])
  AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  )
)
WITH CHECK (
  bucket_id = 'students'
  AND (storage.foldername(name))[1] IN ('photos','documents')
  AND EXISTS (SELECT 1 FROM public.students s WHERE s.scholar_number = (storage.foldername(name))[2])
  AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  )
);

DROP POLICY IF EXISTS "students bucket delete" ON storage.objects;
CREATE POLICY "students bucket delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'students'
  AND EXISTS (SELECT 1 FROM public.students s WHERE s.scholar_number = (storage.foldername(name))[2])
  AND (
    public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')
  )
);

-- 3. Lock down SECURITY DEFINER function execution
DO $$
DECLARE
  fn record;
  allowed text[] := ARRAY[
    'has_role','can_manage_exam_masters','claim_first_admin','invite_user',
    'next_scholar_number','next_employee_code','next_receipt_number',
    'admit_student_with_fee_structure','link_academic_record_fee_structure',
    'generate_student_fee_schedule','bulk_promote_students',
    'regenerate_class_roll_numbers','regenerate_roll_numbers_after_promotion',
    'clone_exam_pattern','version_exam_pattern',
    'go_live_validation','rollback_migration_batch'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    IF fn.proname = ANY (allowed) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    END IF;
  END LOOP;
END $$;