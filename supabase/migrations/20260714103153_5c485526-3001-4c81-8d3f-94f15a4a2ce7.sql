
-- 1. Add student leaving fields
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS date_of_leaving date NULL,
  ADD COLUMN IF NOT EXISTS reason_for_leaving text NULL;

-- 2. Academic sessions: status + closing metadata; enforce only one Active
ALTER TABLE public.academic_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS closed_by uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_sessions_status_check'
  ) THEN
    ALTER TABLE public.academic_sessions
      ADD CONSTRAINT academic_sessions_status_check
      CHECK (status IN ('Draft','Active','Closed'));
  END IF;
END $$;

-- Sync legacy is_active with new status where possible
UPDATE public.academic_sessions SET status = 'Active' WHERE is_active = true AND status <> 'Closed';
UPDATE public.academic_sessions SET status = 'Draft'  WHERE is_active = false AND status = 'Active';

-- Ensure at most one active session
CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_active
  ON public.academic_sessions ((is_active))
  WHERE is_active = true;

-- 3. Activity log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  module text NOT NULL,
  action text NOT NULL,
  entity_type text NULL,
  entity_id text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_idx ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS activity_log_module_idx ON public.activity_log(module);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert own activity" ON public.activity_log;
CREATE POLICY "insert own activity" ON public.activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "read own activity" ON public.activity_log;
CREATE POLICY "read own activity" ON public.activity_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "elevated read all activity" ON public.activity_log;
CREATE POLICY "elevated read all activity" ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'principal')
  );

-- 4. Bulk promotion RPC
CREATE OR REPLACE FUNCTION public.bulk_promote_students(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  itm jsonb;
  new_record_id uuid;
  promoted_count int := 0;
  retained_count int := 0;
  schedules_created int := 0;
  generated int;
BEGIN
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
END $$;

GRANT EXECUTE ON FUNCTION public.bulk_promote_students(jsonb) TO authenticated;
