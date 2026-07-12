ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE public.students ALTER COLUMN admission_number DROP NOT NULL;