
-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.fee_frequency AS ENUM ('Monthly','Quarterly','Annual','One Time','Optional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fee_schedule_status AS ENUM ('Pending','Partial','Paid','Waived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.fee_payment_mode AS ENUM ('Cash','Cheque','UPI','NEFT','RTGS','IMPS','Bank Transfer','Debit Card','Credit Card','QR Code'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ RECEIPT SEQUENCE ============
CREATE SEQUENCE IF NOT EXISTS public.fee_receipt_seq START 1 INCREMENT 1 NO CYCLE;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n bigint;
BEGIN
  SELECT nextval('public.fee_receipt_seq') INTO n;
  RETURN n::text;
END; $$;

REVOKE ALL ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO authenticated, service_role;

-- Prime sequence past any existing numeric receipt_numbers
DO $$ DECLARE mx bigint; BEGIN
  SELECT COALESCE(MAX(receipt_number::bigint), 0) INTO mx
  FROM public.fee_payments WHERE receipt_number ~ '^[0-9]+$';
  IF mx > 0 THEN PERFORM setval('public.fee_receipt_seq', mx, true); END IF;
END $$;

-- ============ EXTEND fee_heads ============
ALTER TABLE public.fee_heads
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS default_frequency public.fee_frequency NOT NULL DEFAULT 'Monthly',
  ADD COLUMN IF NOT EXISTS default_applicable_months int[],
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS fee_heads_code_unique ON public.fee_heads(code) WHERE code IS NOT NULL;

-- Seed default fee heads
INSERT INTO public.fee_heads (name, code, default_frequency, default_applicable_months, is_mandatory, sort_order) VALUES
  ('Tuition Fee','TUITION','Monthly', ARRAY[4,7,8,9,10,11,12,1,2,3], true, 10),
  ('Admission / Readmission Fee','ADMISSION','One Time', NULL, true, 20),
  ('School Management Fee','MGMT','Annual', NULL, true, 30),
  ('Sports & Games Fee','SPORTS','Annual', NULL, true, 40),
  ('Library Fee','LIBRARY','Annual', NULL, true, 50),
  ('Examination Fee','EXAM','Optional', NULL, true, 60),
  ('Red Cross Fee','REDCROSS','Annual', NULL, true, 70),
  ('Annual Activity Fee','ACTIVITY','Annual', NULL, true, 80),
  ('Practical Fee','PRACTICAL','Annual', NULL, false, 90),
  ('Late Payment Fee','LATE','Optional', NULL, false, 100),
  ('Transport Fee','TRANSPORT','Monthly', ARRAY[4,5,6,7,8,9,10,11,12,1,2,3], false, 110)
ON CONFLICT (name) DO NOTHING;

-- ============ EXTEND fee_structures ============
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS academic_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.school_classes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.fee_structures ALTER COLUMN class_name DROP NOT NULL;
ALTER TABLE public.fee_structures ALTER COLUMN academic_year DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_session_class_unique
  ON public.fee_structures(academic_session_id, class_id)
  WHERE academic_session_id IS NOT NULL AND class_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_fee_structures_updated_at ON public.fee_structures;
CREATE TRIGGER trg_fee_structures_updated_at BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ fee_structure_items ============
CREATE TABLE IF NOT EXISTS public.fee_structure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_structure_id uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  fee_head_id uuid NOT NULL REFERENCES public.fee_heads(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  frequency public.fee_frequency NOT NULL DEFAULT 'Monthly',
  applicable_months int[],
  is_optional boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fee_structure_id, fee_head_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_structure_items TO authenticated;
GRANT ALL ON public.fee_structure_items TO service_role;
ALTER TABLE public.fee_structure_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_structure_items select" ON public.fee_structure_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_structure_items insert" ON public.fee_structure_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "fee_structure_items update" ON public.fee_structure_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "fee_structure_items delete" ON public.fee_structure_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_fee_structure_items_updated_at BEFORE UPDATE ON public.fee_structure_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ student_fee_schedule ============
CREATE TABLE IF NOT EXISTS public.student_fee_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_record_id uuid NOT NULL REFERENCES public.student_academic_records(id) ON DELETE CASCADE,
  academic_session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  fee_structure_item_id uuid REFERENCES public.fee_structure_items(id) ON DELETE SET NULL,
  fee_head_id uuid NOT NULL REFERENCES public.fee_heads(id) ON DELETE RESTRICT,
  period_label text NOT NULL,
  period_month int,
  period_year int,
  due_amount numeric(12,2) NOT NULL DEFAULT 0,
  concession_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.fee_schedule_status NOT NULL DEFAULT 'Pending',
  due_date date,
  is_opening_balance boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  sort_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_record_id, fee_head_id, period_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_fee_schedule TO authenticated;
GRANT ALL ON public.student_fee_schedule TO service_role;
ALTER TABLE public.student_fee_schedule ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS student_fee_schedule_student_idx ON public.student_fee_schedule(student_id);
CREATE INDEX IF NOT EXISTS student_fee_schedule_record_idx ON public.student_fee_schedule(academic_record_id);
CREATE INDEX IF NOT EXISTS student_fee_schedule_status_idx ON public.student_fee_schedule(status);

CREATE POLICY "sfs select" ON public.student_fee_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "sfs insert" ON public.student_fee_schedule FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'));
CREATE POLICY "sfs update" ON public.student_fee_schedule FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'));
CREATE POLICY "sfs delete" ON public.student_fee_schedule FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE TRIGGER trg_student_fee_schedule_updated_at BEFORE UPDATE ON public.student_fee_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXTEND fee_payments ============
-- Convert payment_mode to enum (safe: existing rows may have free text; cast via case)
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS academic_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS academic_record_id uuid REFERENCES public.student_academic_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS concession_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transaction_reference text,
  ADD COLUMN IF NOT EXISTS collected_by uuid,
  ADD COLUMN IF NOT EXISTS is_void boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS receipt_print_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Convert payment_mode to enum type
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fee_payments' AND column_name='payment_mode' AND data_type='text') THEN
    ALTER TABLE public.fee_payments
      ALTER COLUMN payment_mode TYPE public.fee_payment_mode
      USING (CASE
        WHEN payment_mode ILIKE 'cash' THEN 'Cash'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'cheque' THEN 'Cheque'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'upi' THEN 'UPI'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'neft' THEN 'NEFT'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'rtgs' THEN 'RTGS'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'imps' THEN 'IMPS'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'bank%transfer' THEN 'Bank Transfer'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'debit%' THEN 'Debit Card'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'credit%' THEN 'Credit Card'::public.fee_payment_mode
        WHEN payment_mode ILIKE 'qr%' THEN 'QR Code'::public.fee_payment_mode
        ELSE 'Cash'::public.fee_payment_mode
      END);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_fee_payments_updated_at ON public.fee_payments;
CREATE TRIGGER trg_fee_payments_updated_at BEFORE UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill session_id from academic_year text
UPDATE public.fee_payments p SET academic_session_id = s.id
  FROM public.academic_sessions s
  WHERE p.academic_session_id IS NULL AND (p.academic_year = s.name);

-- Rewrite fee_payments policies for role model
DROP POLICY IF EXISTS "Admins manage fee_payments" ON public.fee_payments;
DROP POLICY IF EXISTS "Authenticated read fee_payments" ON public.fee_payments;
CREATE POLICY "fee_payments select" ON public.fee_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_payments insert" ON public.fee_payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'));
CREATE POLICY "fee_payments update" ON public.fee_payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'));
-- No delete policy (receipts must never be deleted).

-- ============ fee_payment_allocations ============
CREATE TABLE IF NOT EXISTS public.fee_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_payment_id uuid NOT NULL REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  student_fee_schedule_id uuid NOT NULL REFERENCES public.student_fee_schedule(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payment_allocations TO authenticated;
GRANT ALL ON public.fee_payment_allocations TO service_role;
ALTER TABLE public.fee_payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS fpa_payment_idx ON public.fee_payment_allocations(fee_payment_id);
CREATE INDEX IF NOT EXISTS fpa_schedule_idx ON public.fee_payment_allocations(student_fee_schedule_id);

CREATE POLICY "fpa select" ON public.fee_payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "fpa insert" ON public.fee_payment_allocations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'reception'));
CREATE POLICY "fpa update" ON public.fee_payment_allocations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "fpa delete" ON public.fee_payment_allocations FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- Trigger: recompute schedule paid_amount/status after allocation change
CREATE OR REPLACE FUNCTION public.recompute_schedule_paid()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE sid uuid;
BEGIN
  sid := COALESCE(NEW.student_fee_schedule_id, OLD.student_fee_schedule_id);
  UPDATE public.student_fee_schedule s
  SET paid_amount = COALESCE((
    SELECT SUM(a.amount) FROM public.fee_payment_allocations a
    JOIN public.fee_payments p ON p.id = a.fee_payment_id
    WHERE a.student_fee_schedule_id = sid AND p.is_void = false
  ), 0),
  status = CASE
    WHEN s.due_amount - s.concession_amount <= 0 THEN 'Waived'::fee_schedule_status
    WHEN COALESCE((SELECT SUM(a.amount) FROM public.fee_payment_allocations a JOIN public.fee_payments p ON p.id = a.fee_payment_id WHERE a.student_fee_schedule_id = sid AND p.is_void = false), 0) >= (s.due_amount - s.concession_amount)
      THEN 'Paid'::fee_schedule_status
    WHEN COALESCE((SELECT SUM(a.amount) FROM public.fee_payment_allocations a JOIN public.fee_payments p ON p.id = a.fee_payment_id WHERE a.student_fee_schedule_id = sid AND p.is_void = false), 0) > 0
      THEN 'Partial'::fee_schedule_status
    ELSE 'Pending'::fee_schedule_status
  END
  WHERE s.id = sid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_fpa_recompute ON public.fee_payment_allocations;
CREATE TRIGGER trg_fpa_recompute AFTER INSERT OR UPDATE OR DELETE ON public.fee_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_schedule_paid();

-- Trigger: on fee_payments void, recompute affected schedules
CREATE OR REPLACE FUNCTION public.recompute_on_payment_void()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.is_void IS DISTINCT FROM OLD.is_void THEN
    UPDATE public.student_fee_schedule s
    SET paid_amount = COALESCE((
      SELECT SUM(a.amount) FROM public.fee_payment_allocations a
      JOIN public.fee_payments p ON p.id = a.fee_payment_id
      WHERE a.student_fee_schedule_id = s.id AND p.is_void = false
    ), 0),
    status = CASE
      WHEN s.due_amount - s.concession_amount <= 0 THEN 'Waived'::fee_schedule_status
      WHEN COALESCE((SELECT SUM(a.amount) FROM public.fee_payment_allocations a JOIN public.fee_payments p ON p.id = a.fee_payment_id WHERE a.student_fee_schedule_id = s.id AND p.is_void = false), 0) >= (s.due_amount - s.concession_amount)
        THEN 'Paid'::fee_schedule_status
      WHEN COALESCE((SELECT SUM(a.amount) FROM public.fee_payment_allocations a JOIN public.fee_payments p ON p.id = a.fee_payment_id WHERE a.student_fee_schedule_id = s.id AND p.is_void = false), 0) > 0
        THEN 'Partial'::fee_schedule_status
      ELSE 'Pending'::fee_schedule_status
    END
    WHERE s.id IN (SELECT student_fee_schedule_id FROM public.fee_payment_allocations WHERE fee_payment_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_void_recompute ON public.fee_payments;
CREATE TRIGGER trg_payment_void_recompute AFTER UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.recompute_on_payment_void();

-- ============ fee_concessions ============
CREATE TABLE IF NOT EXISTS public.fee_concessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_session_id uuid NOT NULL REFERENCES public.academic_sessions(id) ON DELETE RESTRICT,
  fee_head_id uuid REFERENCES public.fee_heads(id) ON DELETE SET NULL,
  concession_type text NOT NULL,
  reason text,
  amount numeric(12,2),
  percentage numeric(5,2),
  approved_by uuid,
  approved_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount IS NOT NULL OR percentage IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_concessions TO authenticated;
GRANT ALL ON public.fee_concessions TO service_role;
ALTER TABLE public.fee_concessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_concessions select" ON public.fee_concessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_concessions insert" ON public.fee_concessions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'principal'));
CREATE POLICY "fee_concessions update" ON public.fee_concessions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));
CREATE POLICY "fee_concessions delete" ON public.fee_concessions FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

-- ============ fee_settings (singleton) ============
CREATE TABLE IF NOT EXISTS public.fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  late_fee_enabled boolean NOT NULL DEFAULT false,
  late_fee_amount numeric(12,2) NOT NULL DEFAULT 0,
  late_fee_grace_days int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_settings TO authenticated;
GRANT ALL ON public.fee_settings TO service_role;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_settings select" ON public.fee_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_settings write" ON public.fee_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

INSERT INTO public.fee_settings (late_fee_enabled) SELECT false
  WHERE NOT EXISTS (SELECT 1 FROM public.fee_settings);

CREATE TRIGGER trg_fee_settings_updated_at BEFORE UPDATE ON public.fee_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ generate_student_fee_schedule() ============
CREATE OR REPLACE FUNCTION public.generate_student_fee_schedule(_record_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  rec RECORD;
  itm RECORD;
  sess RECORD;
  month_num int;
  start_year int;
  yr int;
  inserted_count int := 0;
  months_arr int[];
  month_names text[] := ARRAY['January','February','March','April','May','June','July','August','September','October','November','December'];
BEGIN
  SELECT r.*, s.name AS session_name, s.start_date, s.end_date
    INTO rec
    FROM public.student_academic_records r
    JOIN public.academic_sessions s ON s.id = r.academic_session_id
    WHERE r.id = _record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Academic record not found'; END IF;
  IF rec.fee_structure_id IS NULL THEN RETURN 0; END IF;

  start_year := EXTRACT(YEAR FROM rec.start_date)::int;

  -- Opening balance row
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
    SELECT i.*, h.name AS head_name, h.sort_order AS head_sort
    FROM public.fee_structure_items i
    JOIN public.fee_heads h ON h.id = i.fee_head_id
    WHERE i.fee_structure_id = rec.fee_structure_id
    ORDER BY i.sort_order, h.sort_order
  LOOP
    IF itm.frequency = 'Monthly' THEN
      months_arr := COALESCE(itm.applicable_months, ARRAY[]::int[]);
      FOREACH month_num IN ARRAY months_arr LOOP
        -- Session Apr(start)-Mar(end): months 4..12 = start_year, 1..3 = start_year+1
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
    ELSIF itm.frequency = 'Quarterly' THEN
      -- Only when applicable_months configured; otherwise skip
      months_arr := COALESCE(itm.applicable_months, ARRAY[]::int[]);
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
    ELSIF itm.frequency = 'Annual' OR itm.frequency = 'One Time' THEN
      INSERT INTO public.student_fee_schedule
        (student_id, academic_record_id, academic_session_id, fee_structure_item_id, fee_head_id,
         period_label, due_amount, display_order, sort_key)
      VALUES (rec.student_id, rec.id, rec.academic_session_id, itm.id, itm.fee_head_id,
         itm.head_name, itm.amount, 9000 + itm.sort_order,
         '9-'||lpad(itm.sort_order::text,4,'0'))
      ON CONFLICT (academic_record_id, fee_head_id, period_label) DO NOTHING;
      IF FOUND THEN inserted_count := inserted_count + 1; END IF;
    ELSIF itm.frequency = 'Optional' THEN
      -- Optional heads (e.g. Examination Fee) — create a single pending row payable any time
      INSERT INTO public.student_fee_schedule
        (student_id, academic_record_id, academic_session_id, fee_structure_item_id, fee_head_id,
         period_label, due_amount, display_order, sort_key)
      VALUES (rec.student_id, rec.id, rec.academic_session_id, itm.id, itm.fee_head_id,
         itm.head_name, itm.amount, 9500 + itm.sort_order,
         '95-'||lpad(itm.sort_order::text,4,'0'))
      ON CONFLICT (academic_record_id, fee_head_id, period_label) DO NOTHING;
      IF FOUND THEN inserted_count := inserted_count + 1; END IF;
    END IF;
  END LOOP;

  RETURN inserted_count;
END $$;

REVOKE ALL ON FUNCTION public.generate_student_fee_schedule(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_student_fee_schedule(uuid) TO authenticated, service_role;
