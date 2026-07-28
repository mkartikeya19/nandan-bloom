-- 1. Extend teachers master
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_holder_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS ifsc_code text,
  ADD COLUMN IF NOT EXISTS monthly_salary numeric,
  ADD COLUMN IF NOT EXISTS salary_effective_from date,
  ADD COLUMN IF NOT EXISTS total_experience_years numeric,
  ADD COLUMN IF NOT EXISTS previous_school text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

UPDATE public.teachers SET status = 'Active' WHERE status NOT IN ('Active','Inactive');
ALTER TABLE public.teachers ALTER COLUMN status SET DEFAULT 'Active';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_status_check') THEN
    ALTER TABLE public.teachers ADD CONSTRAINT teachers_status_check CHECK (status IN ('Active','Inactive'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS teachers_employee_code_key ON public.teachers (employee_code);

-- 2. Employee ID generator
CREATE SEQUENCE IF NOT EXISTS public.teacher_employee_seq START 1;

CREATE OR REPLACE FUNCTION public.next_employee_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE candidate text;
BEGIN
  LOOP
    candidate := 'NKS-' || lpad(nextval('public.teacher_employee_seq')::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teachers WHERE employee_code = candidate);
  END LOOP;
  RETURN candidate;
END $$;

REVOKE ALL ON FUNCTION public.next_employee_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_employee_code() TO authenticated;

-- align sequence with any existing NKS- codes
SELECT setval('public.teacher_employee_seq',
  GREATEST(1, COALESCE((SELECT MAX(NULLIF(regexp_replace(employee_code, '^NKS-', ''), '')::bigint)
                        FROM public.teachers WHERE employee_code ~ '^NKS-[0-9]+$'), 0)), true);

-- 3. Teacher documents
CREATE TABLE IF NOT EXISTS public.teacher_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  label text,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_documents_teacher_id_idx ON public.teacher_documents (teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_documents TO authenticated;
GRANT ALL ON public.teacher_documents TO service_role;
ALTER TABLE public.teacher_documents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_teacher_documents_updated_at ON public.teacher_documents;
CREATE TRIGGER update_teacher_documents_updated_at BEFORE UPDATE ON public.teacher_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teachers_updated_at ON public.teachers;
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Super-admin-only RLS
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='teachers' LOOP
    EXECUTE format('DROP POLICY %I ON public.teachers', p.policyname);
  END LOOP;
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='teacher_documents' LOOP
    EXECUTE format('DROP POLICY %I ON public.teacher_documents', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage teachers"
  ON public.teachers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage teacher documents"
  ON public.teacher_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

REVOKE ALL ON public.teachers FROM anon;
REVOKE ALL ON public.teacher_documents FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;