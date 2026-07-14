CREATE OR REPLACE FUNCTION public.is_fee_structure_complete(_structure_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_mandatory_heads AS (
    SELECT id
    FROM public.fee_heads
    WHERE is_active = true
      AND is_mandatory = true
  ), configured_mandatory AS (
    SELECT i.fee_head_id
    FROM public.fee_structure_items i
    WHERE i.fee_structure_id = _structure_id
      AND i.amount > 0
  )
  SELECT EXISTS (
           SELECT 1
           FROM public.fee_structure_items i
           WHERE i.fee_structure_id = _structure_id
             AND i.amount > 0
         )
         AND NOT EXISTS (
           SELECT 1
           FROM active_mandatory_heads h
           WHERE NOT EXISTS (
             SELECT 1
             FROM configured_mandatory c
             WHERE c.fee_head_id = h.id
           )
         );
$$;

CREATE OR REPLACE FUNCTION public.find_complete_fee_structure(_academic_session_id uuid, _class_id uuid)
RETURNS TABLE(structure_id uuid, match_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matches AS (
    SELECT fs.id
    FROM public.fee_structures fs
    WHERE fs.academic_session_id = _academic_session_id
      AND fs.class_id = _class_id
      AND fs.is_active = true
      AND public.is_fee_structure_complete(fs.id)
  )
  SELECT
    (SELECT id FROM matches ORDER BY id::text LIMIT 1) AS structure_id,
    (SELECT COUNT(*)::integer FROM matches) AS match_count;
$$;

CREATE OR REPLACE FUNCTION public.validate_active_academic_record_fee_structure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fs_record record;
BEGIN
  IF NEW.status = 'Active' THEN
    IF NEW.fee_structure_id IS NULL THEN
      RAISE EXCEPTION 'Active academic records must have a linked fee structure';
    END IF;

    SELECT id, academic_session_id, class_id, is_active
      INTO fs_record
      FROM public.fee_structures
      WHERE id = NEW.fee_structure_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked fee structure does not exist';
    END IF;

    IF fs_record.academic_session_id IS DISTINCT FROM NEW.academic_session_id
       OR fs_record.class_id IS DISTINCT FROM NEW.class_id
       OR fs_record.is_active IS DISTINCT FROM true
       OR NOT public.is_fee_structure_complete(NEW.fee_structure_id) THEN
      RAISE EXCEPTION 'Linked fee structure must be active, complete, and match the class and session';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_active_academic_record_fee_structure_trigger ON public.student_academic_records;
CREATE TRIGGER validate_active_academic_record_fee_structure_trigger
BEFORE INSERT OR UPDATE OF academic_session_id, class_id, status, fee_structure_id
ON public.student_academic_records
FOR EACH ROW
EXECUTE FUNCTION public.validate_active_academic_record_fee_structure();

CREATE OR REPLACE FUNCTION public.admit_student_with_fee_structure(_student_payload jsonb, _academic_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_student_id uuid;
  new_record_id uuid;
  selected_structure_id uuid;
  matches int;
  generated_count int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin') OR public.has_role(uid, 'reception')) THEN
    RAISE EXCEPTION 'You do not have permission to admit students';
  END IF;

  SELECT structure_id, match_count
    INTO selected_structure_id, matches
    FROM public.find_complete_fee_structure((_academic_payload->>'academic_session_id')::uuid, (_academic_payload->>'class_id')::uuid);

  IF COALESCE(matches, 0) = 0 THEN
    RAISE EXCEPTION 'No Complete Fee Structure exists for this class and session. Please complete a Fee Structure before admitting the student.';
  ELSIF matches > 1 THEN
    RAISE EXCEPTION 'Multiple active Fee Structures found. Please resolve the duplicate before admitting students.';
  END IF;

  INSERT INTO public.students (
    scholar_number, admission_number, full_name, gender, date_of_birth, date_of_admission, admission_type,
    aadhaar_number, apaar_id, pen_id, samagra_id, nationality, religion, category, caste, blood_group,
    mother_tongue, father_name, father_mobile, father_occupation, father_email, mother_name, mother_mobile,
    mother_occupation, mother_email, guardian_name, guardian_phone, guardian_email, emergency_contact_name,
    emergency_contact_number, address, city, state, pincode
  ) VALUES (
    _student_payload->>'scholar_number',
    _student_payload->>'admission_number',
    _student_payload->>'full_name',
    NULLIF(_student_payload->>'gender',''),
    NULLIF(_student_payload->>'date_of_birth','')::date,
    NULLIF(_student_payload->>'date_of_admission','')::date,
    NULLIF(_student_payload->>'admission_type',''),
    NULLIF(_student_payload->>'aadhaar_number',''),
    NULLIF(_student_payload->>'apaar_id',''),
    NULLIF(_student_payload->>'pen_id',''),
    NULLIF(_student_payload->>'samagra_id',''),
    NULLIF(_student_payload->>'nationality',''),
    NULLIF(_student_payload->>'religion',''),
    NULLIF(_student_payload->>'category',''),
    NULLIF(_student_payload->>'caste',''),
    NULLIF(_student_payload->>'blood_group',''),
    NULLIF(_student_payload->>'mother_tongue',''),
    NULLIF(_student_payload->>'father_name',''),
    NULLIF(_student_payload->>'father_mobile',''),
    NULLIF(_student_payload->>'father_occupation',''),
    NULLIF(_student_payload->>'father_email',''),
    NULLIF(_student_payload->>'mother_name',''),
    NULLIF(_student_payload->>'mother_mobile',''),
    NULLIF(_student_payload->>'mother_occupation',''),
    NULLIF(_student_payload->>'mother_email',''),
    NULLIF(_student_payload->>'guardian_name',''),
    NULLIF(_student_payload->>'guardian_phone',''),
    NULLIF(_student_payload->>'guardian_email',''),
    NULLIF(_student_payload->>'emergency_contact_name',''),
    NULLIF(_student_payload->>'emergency_contact_number',''),
    NULLIF(_student_payload->>'address',''),
    NULLIF(_student_payload->>'city',''),
    NULLIF(_student_payload->>'state',''),
    NULLIF(_student_payload->>'pincode','')
  ) RETURNING id INTO new_student_id;

  INSERT INTO public.student_academic_records (
    student_id, academic_session_id, class_id, section_id, roll_number, house_id, joined_on, status, fee_structure_id
  ) VALUES (
    new_student_id,
    (_academic_payload->>'academic_session_id')::uuid,
    (_academic_payload->>'class_id')::uuid,
    (_academic_payload->>'section_id')::uuid,
    NULLIF(_academic_payload->>'roll_number',''),
    NULLIF(_academic_payload->>'house_id','')::uuid,
    COALESCE(NULLIF(_academic_payload->>'joined_on','')::date, CURRENT_DATE),
    COALESCE(NULLIF(_academic_payload->>'status',''), 'Active')::student_academic_status,
    selected_structure_id
  ) RETURNING id INTO new_record_id;

  generated_count := public.generate_student_fee_schedule(new_record_id);

  RETURN jsonb_build_object(
    'student_id', new_student_id,
    'academic_record_id', new_record_id,
    'fee_structure_id', selected_structure_id,
    'generated_count', COALESCE(generated_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_academic_record_fee_structure(_record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec record;
  selected_structure_id uuid;
  matches int;
  generated_count int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'super_admin')) THEN
    RAISE EXCEPTION 'Only Admin/Super Admin can link Fee Structures';
  END IF;

  SELECT * INTO rec
  FROM public.student_academic_records
  WHERE id = _record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Academic record not found';
  END IF;

  SELECT structure_id, match_count
    INTO selected_structure_id, matches
    FROM public.find_complete_fee_structure(rec.academic_session_id, rec.class_id);

  IF COALESCE(matches, 0) = 0 THEN
    RAISE EXCEPTION 'No Complete Fee Structure exists for this class and session. Please complete a Fee Structure before admitting the student.';
  ELSIF matches > 1 THEN
    RAISE EXCEPTION 'Multiple active Fee Structures found. Please resolve the duplicate before admitting students.';
  END IF;

  UPDATE public.student_academic_records
  SET fee_structure_id = selected_structure_id,
      updated_at = now()
  WHERE id = _record_id;

  generated_count := public.generate_student_fee_schedule(_record_id);

  RETURN jsonb_build_object(
    'academic_record_id', _record_id,
    'fee_structure_id', selected_structure_id,
    'generated_count', COALESCE(generated_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_fee_structure_complete(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_complete_fee_structure(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) TO authenticated, service_role;

ALTER TABLE public.student_academic_records
  ADD CONSTRAINT student_academic_records_fee_structure_fk
  FOREIGN KEY (fee_structure_id) REFERENCES public.fee_structures(id)
  NOT VALID;

ALTER TABLE public.student_academic_records
  ADD CONSTRAINT active_academic_records_require_fee_structure
  CHECK (status <> 'Active'::student_academic_status OR fee_structure_id IS NOT NULL)
  NOT VALID;