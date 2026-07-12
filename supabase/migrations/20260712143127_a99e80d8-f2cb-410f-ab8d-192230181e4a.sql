
-- admission_type enum
DO $$ BEGIN
  CREATE TYPE public.student_admission_type AS ENUM ('New Admission','Existing Student Migration','Re-admission');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- students: add columns (all nullable, no db-level uniqueness on ID fields)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_admission date,
  ADD COLUMN IF NOT EXISTS admission_type public.student_admission_type,
  ADD COLUMN IF NOT EXISTS apaar_id text,
  ADD COLUMN IF NOT EXISTS pen_id text,
  ADD COLUMN IF NOT EXISTS samagra_id text,
  ADD COLUMN IF NOT EXISTS caste text,
  ADD COLUMN IF NOT EXISTS mother_tongue text,
  ADD COLUMN IF NOT EXISTS father_mobile text,
  ADD COLUMN IF NOT EXISTS father_email text,
  ADD COLUMN IF NOT EXISTS father_occupation text,
  ADD COLUMN IF NOT EXISTS mother_mobile text,
  ADD COLUMN IF NOT EXISTS mother_email text,
  ADD COLUMN IF NOT EXISTS mother_occupation text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_number text,
  ADD COLUMN IF NOT EXISTS birth_certificate_url text,
  ADD COLUMN IF NOT EXISTS aadhaar_copy_url text,
  ADD COLUMN IF NOT EXISTS transfer_certificate_url text,
  ADD COLUMN IF NOT EXISTS other_documents jsonb;

-- student_academic_records: add house_id
ALTER TABLE public.student_academic_records
  ADD COLUMN IF NOT EXISTS house_id uuid REFERENCES public.houses(id) ON DELETE SET NULL;

-- next_scholar_number() — max numeric + 1, ignores non-numeric values
CREATE OR REPLACE FUNCTION public.next_scholar_number()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_num bigint;
BEGIN
  SELECT COALESCE(MAX(scholar_number::bigint), 0) + 1
    INTO next_num
    FROM public.students
    WHERE scholar_number ~ '^[0-9]+$';
  RETURN next_num::text;
END;
$$;
REVOKE ALL ON FUNCTION public.next_scholar_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_scholar_number() TO authenticated;

-- students RLS — widen writes to reception; keep delete super_admin only
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Staff can insert students" ON public.students;
DROP POLICY IF EXISTS "Staff can update students" ON public.students;
DROP POLICY IF EXISTS "Super admins can delete students" ON public.students;

CREATE POLICY "Staff can insert students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  );

CREATE POLICY "Staff can update students" ON public.students
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  );

CREATE POLICY "Super admins can delete students" ON public.students
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- student_academic_records RLS — widen writes to reception
DROP POLICY IF EXISTS "Staff can insert academic records" ON public.student_academic_records;
DROP POLICY IF EXISTS "Staff can update academic records" ON public.student_academic_records;
DROP POLICY IF EXISTS "Admins manage academic records" ON public.student_academic_records;
DROP POLICY IF EXISTS "Admins can delete academic records" ON public.student_academic_records;

CREATE POLICY "Staff can insert academic records" ON public.student_academic_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  );

CREATE POLICY "Staff can update academic records" ON public.student_academic_records
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'reception')
  );

CREATE POLICY "Admins can delete academic records" ON public.student_academic_records
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'admin')
  );

-- Storage policies for the `students` bucket
DROP POLICY IF EXISTS "students bucket read" ON storage.objects;
DROP POLICY IF EXISTS "students bucket insert" ON storage.objects;
DROP POLICY IF EXISTS "students bucket update" ON storage.objects;
DROP POLICY IF EXISTS "students bucket delete" ON storage.objects;

CREATE POLICY "students bucket read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'students' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'reception')
      OR public.has_role(auth.uid(),'teacher')
      OR public.has_role(auth.uid(),'principal')
      OR public.has_role(auth.uid(),'staff')
    )
  );

CREATE POLICY "students bucket insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'students' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'reception')
    )
  );

CREATE POLICY "students bucket update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'students' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'reception')
    )
  );

CREATE POLICY "students bucket delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'students' AND (
      public.has_role(auth.uid(),'super_admin')
      OR public.has_role(auth.uid(),'admin')
    )
  );
