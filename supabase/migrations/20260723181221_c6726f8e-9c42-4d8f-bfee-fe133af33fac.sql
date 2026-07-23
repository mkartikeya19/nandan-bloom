
-- =========================================================
-- PART A: Fee collection mode preference
-- =========================================================
ALTER TABLE public.fee_settings
  ADD COLUMN IF NOT EXISTS default_collection_mode text NOT NULL DEFAULT 'auto'
    CHECK (default_collection_mode IN ('auto','manual','ask'));

-- =========================================================
-- PHASE 1: Examination master data
-- Drop legacy empty placeholders first
-- =========================================================
DROP TABLE IF EXISTS public.exam_results CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;

-- Helper: role check for exam admin writes
CREATE OR REPLACE FUNCTION public.can_manage_exam_masters(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin')
      OR public.has_role(_uid, 'super_admin')
      OR public.has_role(_uid, 'principal')
$$;
REVOKE ALL ON FUNCTION public.can_manage_exam_masters(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_exam_masters(uuid) TO authenticated, service_role;

-- ---------- exam_subjects ----------
CREATE TABLE public.exam_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_subjects TO authenticated;
GRANT ALL ON public.exam_subjects TO service_role;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view exam subjects" ON public.exam_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write exam subjects" ON public.exam_subjects FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_subjects_updated BEFORE UPDATE ON public.exam_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- exam_class_subjects ----------
CREATE TABLE public.exam_class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.exam_subjects(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);
CREATE INDEX idx_exam_class_subjects_class ON public.exam_class_subjects(class_id);
CREATE INDEX idx_exam_class_subjects_subject ON public.exam_class_subjects(subject_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_class_subjects TO authenticated;
GRANT ALL ON public.exam_class_subjects TO service_role;
ALTER TABLE public.exam_class_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view class subjects" ON public.exam_class_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write class subjects" ON public.exam_class_subjects FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_class_subjects_updated BEFORE UPDATE ON public.exam_class_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- exam_class_subject_components ----------
CREATE TABLE public.exam_class_subject_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_subject_id uuid NOT NULL REFERENCES public.exam_class_subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  max_marks numeric(6,2) NOT NULL CHECK (max_marks > 0),
  is_practical boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_subject_id, name)
);
CREATE INDEX idx_exam_class_subject_components_cs ON public.exam_class_subject_components(class_subject_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_class_subject_components TO authenticated;
GRANT ALL ON public.exam_class_subject_components TO service_role;
ALTER TABLE public.exam_class_subject_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view components" ON public.exam_class_subject_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write components" ON public.exam_class_subject_components FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_components_updated BEFORE UPDATE ON public.exam_class_subject_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- exam_grade_scales / bands ----------
CREATE TABLE public.exam_grade_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_grade_scales TO authenticated;
GRANT ALL ON public.exam_grade_scales TO service_role;
ALTER TABLE public.exam_grade_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view scales" ON public.exam_grade_scales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write scales" ON public.exam_grade_scales FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_grade_scales_updated BEFORE UPDATE ON public.exam_grade_scales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.exam_grade_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES public.exam_grade_scales(id) ON DELETE CASCADE,
  min_percent numeric(5,2) NOT NULL CHECK (min_percent >= 0 AND min_percent <= 100),
  max_percent numeric(5,2) NOT NULL CHECK (max_percent >= 0 AND max_percent <= 100),
  grade text NOT NULL,
  remark text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_percent <= max_percent)
);
CREATE INDEX idx_exam_grade_bands_scale ON public.exam_grade_bands(scale_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_grade_bands TO authenticated;
GRANT ALL ON public.exam_grade_bands TO service_role;
ALTER TABLE public.exam_grade_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view bands" ON public.exam_grade_bands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write bands" ON public.exam_grade_bands FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_grade_bands_updated BEFORE UPDATE ON public.exam_grade_bands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent overlapping bands per scale
CREATE OR REPLACE FUNCTION public.validate_grade_band_no_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.exam_grade_bands b
    WHERE b.scale_id = NEW.scale_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT (NEW.max_percent < b.min_percent OR NEW.min_percent > b.max_percent)
  ) THEN
    RAISE EXCEPTION 'Grade band overlaps with an existing band in this scale';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_exam_grade_bands_no_overlap
  BEFORE INSERT OR UPDATE ON public.exam_grade_bands
  FOR EACH ROW EXECUTE FUNCTION public.validate_grade_band_no_overlap();

-- ---------- exam_patterns (versioned + immutable when locked) ----------
CREATE TABLE public.exam_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  version int NOT NULL DEFAULT 1,
  parent_pattern_id uuid REFERENCES public.exam_patterns(id) ON DELETE SET NULL,
  grade_scale_id uuid REFERENCES public.exam_grade_scales(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_session_id, name, version)
);
CREATE INDEX idx_exam_patterns_session ON public.exam_patterns(academic_session_id);
CREATE INDEX idx_exam_patterns_parent ON public.exam_patterns(parent_pattern_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_patterns TO authenticated;
GRANT ALL ON public.exam_patterns TO service_role;
ALTER TABLE public.exam_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view patterns" ON public.exam_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write patterns" ON public.exam_patterns FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_patterns_updated BEFORE UPDATE ON public.exam_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- exam_pattern_classes ----------
CREATE TABLE public.exam_pattern_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid NOT NULL REFERENCES public.exam_patterns(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pattern_id, class_id)
);
CREATE INDEX idx_exam_pattern_classes_pattern ON public.exam_pattern_classes(pattern_id);
CREATE INDEX idx_exam_pattern_classes_class ON public.exam_pattern_classes(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_pattern_classes TO authenticated;
GRANT ALL ON public.exam_pattern_classes TO service_role;
ALTER TABLE public.exam_pattern_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view pattern classes" ON public.exam_pattern_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write pattern classes" ON public.exam_pattern_classes FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));

-- ---------- exam_pattern_terms ----------
CREATE TABLE public.exam_pattern_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid NOT NULL REFERENCES public.exam_patterns(id) ON DELETE CASCADE,
  name text NOT NULL,
  weightage_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (weightage_percent >= 0 AND weightage_percent <= 100),
  include_in_final boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pattern_id, name)
);
CREATE INDEX idx_exam_pattern_terms_pattern ON public.exam_pattern_terms(pattern_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_pattern_terms TO authenticated;
GRANT ALL ON public.exam_pattern_terms TO service_role;
ALTER TABLE public.exam_pattern_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view pattern terms" ON public.exam_pattern_terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can write pattern terms" ON public.exam_pattern_terms FOR ALL TO authenticated
  USING (public.can_manage_exam_masters(auth.uid())) WITH CHECK (public.can_manage_exam_masters(auth.uid()));
CREATE TRIGGER trg_exam_pattern_terms_updated BEFORE UPDATE ON public.exam_pattern_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Immutability triggers for locked patterns ----------
CREATE OR REPLACE FUNCTION public.block_locked_pattern_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  locked boolean;
  target_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'exam_patterns' THEN
    IF TG_OP = 'UPDATE' THEN
      -- Allow unlock/lock toggles by managers, allow is_active toggle
      IF OLD.is_locked = true AND (
        NEW.name IS DISTINCT FROM OLD.name OR
        NEW.version IS DISTINCT FROM OLD.version OR
        NEW.academic_session_id IS DISTINCT FROM OLD.academic_session_id OR
        NEW.grade_scale_id IS DISTINCT FROM OLD.grade_scale_id OR
        NEW.parent_pattern_id IS DISTINCT FROM OLD.parent_pattern_id
      ) THEN
        RAISE EXCEPTION 'Exam pattern is locked. Create a new version to make changes.';
      END IF;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.is_locked = true THEN
        RAISE EXCEPTION 'Locked exam patterns cannot be deleted.';
      END IF;
      RETURN OLD;
    END IF;
  ELSE
    -- child tables: pattern_terms, pattern_classes
    target_id := COALESCE(NEW.pattern_id, OLD.pattern_id);
    SELECT is_locked INTO locked FROM public.exam_patterns WHERE id = target_id;
    IF locked THEN
      RAISE EXCEPTION 'Exam pattern is locked. Create a new version to make changes.';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_patterns_immutable
  BEFORE UPDATE OR DELETE ON public.exam_patterns
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_pattern_write();
CREATE TRIGGER trg_pattern_terms_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.exam_pattern_terms
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_pattern_write();
CREATE TRIGGER trg_pattern_classes_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.exam_pattern_classes
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_pattern_write();

-- ---------- Clone / Version helpers ----------
CREATE OR REPLACE FUNCTION public.clone_exam_pattern(_source_id uuid, _new_session_id uuid, _new_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  src record;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_exam_masters(uid) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO src FROM public.exam_patterns WHERE id = _source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source pattern not found'; END IF;

  INSERT INTO public.exam_patterns (academic_session_id, name, version, parent_pattern_id, grade_scale_id, is_active, created_by)
  VALUES (_new_session_id, COALESCE(NULLIF(_new_name,''), src.name), 1, NULL, src.grade_scale_id, true, uid)
  RETURNING id INTO new_id;

  INSERT INTO public.exam_pattern_terms (pattern_id, name, weightage_percent, include_in_final, sort_order)
  SELECT new_id, name, weightage_percent, include_in_final, sort_order
  FROM public.exam_pattern_terms WHERE pattern_id = _source_id;

  INSERT INTO public.exam_pattern_classes (pattern_id, class_id)
  SELECT new_id, class_id FROM public.exam_pattern_classes WHERE pattern_id = _source_id;

  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.clone_exam_pattern(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clone_exam_pattern(uuid,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.version_exam_pattern(_source_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  src record;
  new_id uuid;
  next_ver int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_exam_masters(uid) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO src FROM public.exam_patterns WHERE id = _source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source pattern not found'; END IF;

  SELECT COALESCE(MAX(version),0)+1 INTO next_ver
  FROM public.exam_patterns
  WHERE academic_session_id = src.academic_session_id AND name = src.name;

  INSERT INTO public.exam_patterns (academic_session_id, name, version, parent_pattern_id, grade_scale_id, is_active, created_by)
  VALUES (src.academic_session_id, src.name, next_ver, src.id, src.grade_scale_id, true, uid)
  RETURNING id INTO new_id;

  INSERT INTO public.exam_pattern_terms (pattern_id, name, weightage_percent, include_in_final, sort_order)
  SELECT new_id, name, weightage_percent, include_in_final, sort_order
  FROM public.exam_pattern_terms WHERE pattern_id = _source_id;

  INSERT INTO public.exam_pattern_classes (pattern_id, class_id)
  SELECT new_id, class_id FROM public.exam_pattern_classes WHERE pattern_id = _source_id;

  -- Deactivate the older version so only newest is active by default
  UPDATE public.exam_patterns SET is_active = false WHERE id = _source_id;

  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.version_exam_pattern(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.version_exam_pattern(uuid) TO authenticated, service_role;
