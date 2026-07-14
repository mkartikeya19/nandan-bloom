
-- Add applicability rule to fee_structure_items
DO $$ BEGIN
  CREATE TYPE public.fee_applicability AS ENUM ('All', 'NewAdmission', 'Existing', 'Optional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.fee_structure_items
  ADD COLUMN IF NOT EXISTS applicability public.fee_applicability NOT NULL DEFAULT 'All';

-- Update schedule generator to respect applicability
CREATE OR REPLACE FUNCTION public.generate_student_fee_schedule(_record_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  itm RECORD;
  month_num int;
  start_year int;
  yr int;
  inserted_count int := 0;
  months_arr int[];
  is_new_admission boolean;
  month_names text[] := ARRAY['January','February','March','April','May','June','July','August','September','October','November','December'];
BEGIN
  SELECT r.*, s.name AS session_name, s.start_date, s.end_date
    INTO rec
    FROM public.student_academic_records r
    JOIN public.academic_sessions s ON s.id = r.academic_session_id
    WHERE r.id = _record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Academic record not found'; END IF;
  IF rec.fee_structure_id IS NULL THEN RETURN 0; END IF;

  -- A student is a "new admission" for this record if it was NOT promoted from a prior record.
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
           COALESCE(i.frequency, h.default_frequency) AS effective_frequency,
           COALESCE(i.applicable_months, h.default_applicable_months) AS effective_months
    FROM public.fee_structure_items i
    JOIN public.fee_heads h ON h.id = i.fee_head_id
    WHERE i.fee_structure_id = rec.fee_structure_id
    ORDER BY i.sort_order, h.sort_order
  LOOP
    -- Skip heads flagged as manual / non-auto
    IF itm.head_auto_generate = false OR itm.head_charge_trigger = 'Manual' THEN
      CONTINUE;
    END IF;

    -- Skip based on applicability rule
    IF itm.applicability = 'Optional' THEN
      CONTINUE; -- Optional items are only charged when explicitly added
    ELSIF itm.applicability = 'NewAdmission' AND NOT is_new_admission THEN
      CONTINUE;
    ELSIF itm.applicability = 'Existing' AND is_new_admission THEN
      CONTINUE;
    END IF;

    IF itm.effective_frequency = 'Monthly' THEN
      months_arr := COALESCE(itm.effective_months, ARRAY[]::int[]);
      FOREACH month_num IN ARRAY months_arr LOOP
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
      -- Frequency 'Optional' also means don't auto-generate
      CONTINUE;
    END IF;
  END LOOP;

  RETURN inserted_count;
END $function$;
