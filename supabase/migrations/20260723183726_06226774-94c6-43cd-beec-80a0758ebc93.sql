
-- H-1: Academic Session integrity

-- 1) Normalize existing data: only the is_active row stays Active
UPDATE public.academic_sessions
SET status = 'Draft'
WHERE status = 'Active' AND is_active = false;

UPDATE public.academic_sessions
SET status = 'Active'
WHERE is_active = true AND status <> 'Active';

-- Keep is_active <-> status='Active' in sync (safety)
UPDATE public.academic_sessions SET is_active = false WHERE status <> 'Active' AND is_active = true;

-- 2) Partial unique indexes: only one Active session
CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_active
  ON public.academic_sessions ((status)) WHERE status = 'Active';
CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_is_active
  ON public.academic_sessions ((is_active)) WHERE is_active = true;

-- 3) State-transition trigger
CREATE OR REPLACE FUNCTION public.validate_academic_session_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Keep is_active in sync with status
  IF NEW.status = 'Active' THEN
    NEW.is_active := true;
  ELSE
    NEW.is_active := false;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Allowed transitions: Draft->Active, Active->Closed, Active->Draft,
    -- Closed->Draft (reopen), same->same
    IF OLD.status = 'Closed' AND NEW.status = 'Active' THEN
      RAISE EXCEPTION 'Cannot transition directly from Closed to Active. Reopen to Draft first.';
    END IF;
    IF OLD.status = 'Draft' AND NEW.status = 'Closed' THEN
      RAISE EXCEPTION 'Cannot close a Draft session. Activate it first.';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_academic_session_transition ON public.academic_sessions;
CREATE TRIGGER trg_validate_academic_session_transition
  BEFORE INSERT OR UPDATE ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.validate_academic_session_transition();
