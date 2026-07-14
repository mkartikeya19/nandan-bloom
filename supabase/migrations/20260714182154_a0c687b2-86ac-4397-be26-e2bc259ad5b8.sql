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

  IF matches > 1 THEN
    RAISE EXCEPTION 'Multiple active Fee Structures found. Please resolve the duplicate before admitting students.';
  ELSIF COALESCE(matches, 0) = 0 OR selected_structure_id IS NULL THEN
    RAISE EXCEPTION 'No Complete Fee Structure exists for this class and session. Please complete a Fee Structure before admitting the student.';
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

  IF matches > 1 THEN
    RAISE EXCEPTION 'Multiple active Fee Structures found. Please resolve the duplicate before admitting students.';
  ELSIF COALESCE(matches, 0) = 0 OR selected_structure_id IS NULL THEN
    RAISE EXCEPTION 'No Complete Fee Structure exists for this class and session. Please complete a Fee Structure before admitting the student.';
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

REVOKE EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) TO authenticated, service_role;