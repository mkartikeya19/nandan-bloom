
-- 1. Drop legacy classes references and table
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_class_id_fkey;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE public.students DROP COLUMN IF EXISTS class_id;
ALTER TABLE public.students DROP COLUMN IF EXISTS academic_year;
DROP TABLE IF EXISTS public.classes;

-- 2. Add scholar_number as permanent identifier
ALTER TABLE public.students
  ADD COLUMN scholar_number text NOT NULL UNIQUE;

-- 3. Status enum for academic records
DO $$ BEGIN
  CREATE TYPE public.student_academic_status AS ENUM
    ('Active','Promoted','Left','Passed Out','Transferred','Inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. student_academic_records
CREATE TABLE public.student_academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL REFERENCES public.school_sections(id) ON DELETE RESTRICT,
  roll_number text,
  status public.student_academic_status NOT NULL DEFAULT 'Active',
  joined_on date NOT NULL DEFAULT CURRENT_DATE,
  fee_structure_id uuid,
  opening_balance numeric(12,2),
  promoted_from_record_id uuid REFERENCES public.student_academic_records(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_academic_records_student_session_key UNIQUE (student_id, academic_session_id)
);

CREATE UNIQUE INDEX student_academic_records_roll_unique
  ON public.student_academic_records (academic_session_id, class_id, section_id, roll_number)
  WHERE roll_number IS NOT NULL;

CREATE INDEX student_academic_records_student_idx ON public.student_academic_records (student_id);
CREATE INDEX student_academic_records_session_idx ON public.student_academic_records (academic_session_id);
CREATE INDEX student_academic_records_class_section_idx ON public.student_academic_records (class_id, section_id);

-- 5. Section must belong to selected class
CREATE OR REPLACE FUNCTION public.validate_section_belongs_to_class()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE sec_class uuid;
BEGIN
  SELECT class_id INTO sec_class FROM public.school_sections WHERE id = NEW.section_id;
  IF sec_class IS NULL OR sec_class <> NEW.class_id THEN
    RAISE EXCEPTION 'Section % does not belong to class %', NEW.section_id, NEW.class_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_section_class
BEFORE INSERT OR UPDATE ON public.student_academic_records
FOR EACH ROW EXECUTE FUNCTION public.validate_section_belongs_to_class();

CREATE TRIGGER trg_student_academic_records_updated_at
BEFORE UPDATE ON public.student_academic_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Grants + RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_academic_records TO authenticated;
GRANT ALL ON public.student_academic_records TO service_role;

ALTER TABLE public.student_academic_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view academic records"
  ON public.student_academic_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert academic records"
  ON public.student_academic_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can update academic records"
  ON public.student_academic_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins can delete academic records"
  ON public.student_academic_records FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));
