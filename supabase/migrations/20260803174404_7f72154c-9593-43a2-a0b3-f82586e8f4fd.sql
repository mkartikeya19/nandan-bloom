CREATE OR REPLACE FUNCTION public.bulk_promote_students(_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  itm jsonb;
  new_record_id uuid;
  promoted_count int := 0;
  retained_count int := 0;
  schedules_created int := 0;
  generated int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'super_admin') OR public.has_role(uid,'principal')) THEN
    RAISE EXCEPTION 'You do not have permission to promote students';
  END IF;

  FOR itm IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    INSERT INTO public.student_academic_records
      (student_id, academic_session_id, class_id, section_id, house_id, roll_number, joined_on, status, fee_structure_id, promoted_from_record_id)
    VALUES
      ((itm->>'student_id')::uuid,
       (itm->>'new_session_id')::uuid,
       (itm->>'new_class_id')::uuid,
       (itm->>'new_section_id')::uuid,
       NULLIF(itm->>'new_house_id','')::uuid,
       NULLIF(itm->>'new_roll_number',''),
       COALESCE((itm->>'joined_on')::date, CURRENT_DATE),
       'Active',
       NULLIF(itm->>'fee_structure_id','')::uuid,
       NULLIF(itm->>'previous_record_id','')::uuid)
    RETURNING id INTO new_record_id;

    IF (itm->>'action') = 'retain' THEN
      retained_count := retained_count + 1;
    ELSE
      promoted_count := promoted_count + 1;
    END IF;

    IF COALESCE((itm->>'generate_schedule')::boolean, true) AND (itm->>'fee_structure_id') IS NOT NULL THEN
      generated := public.generate_student_fee_schedule(new_record_id);
      schedules_created := schedules_created + COALESCE(generated,0);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'promoted', promoted_count,
    'retained', retained_count,
    'schedules_created', schedules_created
  );
END $function$;

CREATE OR REPLACE FUNCTION public.generate_student_fee_schedule(_record_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  rec RECORD;
  itm RECORD;
  month_num int;
  start_year int;
  yr int;
  inserted_count int := 0;
  months_arr int[];
  is_new_admission boolean;
  eff_applicability public.fee_applicability;
  month_names text[] := ARRAY['January','February','March','April','May','June','July','August','September','October','November','December'];
BEGIN
  IF uid IS NOT NULL AND NOT (
       public.has_role(uid,'admin') OR public.has_role(uid,'super_admin')
       OR public.has_role(uid,'principal') OR public.has_role(uid,'reception')
     ) THEN
    RAISE EXCEPTION 'You do not have permission to generate fee schedules';
  END IF;

  SELECT r.*, s.name AS session_name, s.start_date, s.end_date
    INTO rec
    FROM public.student_academic_records r
    JOIN public.academic_sessions s ON s.id = r.academic_session_id
    WHERE r.id = _record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Academic record not found'; END IF;
  IF rec.fee_structure_id IS NULL THEN RETURN 0; END IF;

  is_new_admission := (rec.promoted_from_record_id IS NULL);
  start_year := EXTRACT(YEAR FROM rec.start_date)::int;

  IF COALESCE(rec.opening_balance, 0) > 0 THEN
    INSERT INTO public.student_fee_schedule
      (student_id, academic_record_id, academic_session_id, fee_head_id, period_label,
       due_amount, is_opening_balance, display_order, sort_key)
    SELECT rec.student_id, rec.id, rec.academic_session_id,
      (SELECT id FROM public.fee_heads WHERE code = 'TUITION' LIMIT 1),
      'Opening Balance', rec.opening_balance, true, 0, '0000-OPENING'
    ON CONFLICT (academic_record_id, fee_head_id, period_label) DO NOTHING;
    IF FOUND THEN inserted_count := inserted_count + 1; END IF;
  END IF;

  FOR itm IN
    SELECT i.*, h.name AS head_name, h.sort_order AS head_sort,
           h.auto_generate AS head_auto_generate,
           h.charge_trigger AS head_charge_trigger,
           h.default_applicability AS head_default_applicability,
           COALESCE(i.frequency, h.default_frequency) AS effective_frequency,
           COALESCE(i.applicable_months, h.default_applicable_months) AS effective_months
    FROM public.fee_structure_items i
    JOIN public.fee_heads h ON h.id = i.fee_head_id
    WHERE i.fee_structure_id = rec.fee_structure_id
    ORDER BY i.sort_order, h.sort_order
  LOOP
    IF itm.head_auto_generate = false OR itm.head_charge_trigger = 'Manual' THEN
      CONTINUE;
    END IF;

    eff_applicability := COALESCE(itm.applicability, itm.head_default_applicability, 'All'::public.fee_applicability);

    IF eff_applicability = 'Optional' THEN
      CONTINUE;
    ELSIF eff_applicability = 'NewAdmission' AND NOT is_new_admission THEN
      CONTINUE;
    ELSIF eff_applicability = 'Existing' AND is_new_admission THEN
      CONTINUE;
    END IF;

    IF itm.effective_frequency = 'Monthly' THEN
      months_arr := COALESCE(itm.effective_months, ARRAY[]::int[]);
      FOREACH month_num IN ARRAY months_arr LOOP
        IF month_num IN (5,6) THEN CONTINUE; END IF;
        yr := CASE WHEN month_num >= EXTRACT(MONTH FROM rec.start_date)::int THEN start_year ELSE start_year + 1 END;
        INSERT INTO public.student_fee_schedule
          (student_id, academic_record_id, academic_session_id, fee_structure_item_id, fee_head_id,
           period_label, period_month, period_year, due_amount, display_order, sort_key)
        VALUES (rec.student_id, rec.id, rec.academic_session_id, itm.id, itm.fee_head_id,
           month_names[month_num]||' '||yr, month_num, yr, itm.amount,
           itm.sort_order * 100 + month_num,
           lpad(yr::text,4,'0')||'-'||lpad(month_num::text,2,'0')||'-'||lpad(itm.sort_order::text,4,'0'))
        ON CONFLICT (academic_record_id, fee_head_id, period_label) DO NOTHING;
        IF FOUND THEN inserted_count := inserted_count + 1; END IF;
      END LOOP;
    ELSIF itm.effective_frequency = 'Quarterly' THEN
      months_arr := COALESCE(itm.effective_months, ARRAY[]::int[]);
      FOREACH month_num IN ARRAY months_arr LOOP
        IF month_num IN (5,6) THEN CONTINUE; END IF;
        yr := CASE WHEN month_num >= EXTRACT(MONTH FROM rec.start_date)::int THEN start_year ELSE start_year + 1 END;
        INSERT INTO public.student_fee_schedule
          (student_id, academic_record_id, academic_session_id, fee_structure_item_id, fee_head_id,
           period_label, period_month, period_year, due_amount, display_order, sort_key)
        VALUES (rec.student_id, rec.id, rec.academic_session_id, itm.id, itm.fee_head_id,
           'Q '||month_names[month_num]||' '||yr, month_num, yr, itm.amount,
           itm.sort_order * 100 + month_num,
           lpad(yr::text,4,'0')||'-'||lpad(month_num::text,2,'0')||'-Q-'||lpad(itm.sort_order::text,4,'0'))
        ON CONFLICT (academic_record_id, fee_head_id, period_label) DO NOTHING;
        IF FOUND THEN inserted_count := inserted_count + 1; END IF;
      END LOOP;
    ELSIF itm.effective_frequency = 'Annual' OR itm.effective_frequency = 'One Time' THEN
      INSERT INTO public.student_fee_schedule
        (student_id, academic_record_id, academic_session_id, fee_structure_item_id, fee_head_id,
         period_label, due_amount, display_order, sort_key)
      VALUES (rec.student_id, rec.id, rec.academic_session_id, itm.id, itm.fee_head_id,
         itm.head_name, itm.amount, 9000 + itm.sort_order,
         '9-'||lpad(itm.sort_order::text,4,'0'))
      ON CONFLICT (academic_record_id, fee_head_id, period_label) DO NOTHING;
      IF FOUND THEN inserted_count := inserted_count + 1; END IF;
    ELSIF itm.effective_frequency = 'Optional' THEN
      CONTINUE;
    END IF;
  END LOOP;

  RETURN inserted_count;
END $function$;