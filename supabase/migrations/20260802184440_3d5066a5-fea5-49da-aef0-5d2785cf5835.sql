-- 1. Invitation-only onboarding ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  roles public.app_role[] NOT NULL DEFAULT ARRAY['staff']::public.app_role[],
  full_name text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_user_id uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_pending_email_idx
  ON public.user_invitations (email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invitations TO authenticated;
GRANT ALL ON public.user_invitations TO service_role;

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage invitations"
  ON public.user_invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER user_invitations_updated_at
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Assign roles from a matching invitation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv record;
  r public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);

  SELECT * INTO inv
  FROM public.user_invitations
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    FOREACH r IN ARRAY inv.roles LOOP
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, r)
      ON CONFLICT (user_id, role) DO NOTHING;
    END LOOP;

    UPDATE public.user_invitations
      SET accepted_at = now(), accepted_user_id = NEW.id
      WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_user(_email text, _roles public.app_role[], _full_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admins can invite users';
  END IF;
  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF _roles IS NULL OR array_length(_roles, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one role is required';
  END IF;

  UPDATE public.user_invitations
    SET revoked_at = now()
    WHERE email = _email::citext AND accepted_at IS NULL AND revoked_at IS NULL;

  INSERT INTO public.user_invitations (email, roles, full_name, invited_by)
  VALUES (_email::citext, _roles, NULLIF(btrim(coalesce(_full_name,'')), ''), uid)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 2. Payment validation in the database ----------------------------------------
CREATE OR REPLACE FUNCTION public.validate_fee_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.receipt_number IS DISTINCT FROM OLD.receipt_number THEN
      RAISE EXCEPTION 'Receipt number cannot be changed';
    END IF;
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'Receipt amount is immutable. Void the receipt and re-post instead.';
    END IF;
    IF OLD.is_void = true AND NEW.is_void = false THEN
      RAISE EXCEPTION 'A voided receipt cannot be un-voided.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_fee_payment_trg ON public.fee_payments;
CREATE TRIGGER validate_fee_payment_trg
  BEFORE INSERT OR UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_fee_payment();

CREATE OR REPLACE FUNCTION public.validate_fee_payment_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  pay record;
  sched record;
  allocated_on_payment numeric;
  paid_on_schedule numeric;
  outstanding numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Allocation amount must be greater than zero';
  END IF;

  SELECT id, amount, is_void INTO pay
  FROM public.fee_payments WHERE id = NEW.fee_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF pay.is_void THEN
    RAISE EXCEPTION 'Cannot allocate against a voided receipt';
  END IF;

  SELECT COALESCE(SUM(a.amount), 0) INTO allocated_on_payment
  FROM public.fee_payment_allocations a
  WHERE a.fee_payment_id = NEW.fee_payment_id
    AND (TG_OP = 'INSERT' OR a.id <> NEW.id);

  IF allocated_on_payment + NEW.amount > pay.amount + 0.01 THEN
    RAISE EXCEPTION 'Allocated total (%) exceeds the receipt amount (%)',
      allocated_on_payment + NEW.amount, pay.amount;
  END IF;

  SELECT due_amount, concession_amount INTO sched
  FROM public.student_fee_schedule WHERE id = NEW.student_fee_schedule_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fee schedule row not found'; END IF;

  SELECT COALESCE(SUM(a.amount), 0) INTO paid_on_schedule
  FROM public.fee_payment_allocations a
  JOIN public.fee_payments p ON p.id = a.fee_payment_id
  WHERE a.student_fee_schedule_id = NEW.student_fee_schedule_id
    AND p.is_void = false
    AND (TG_OP = 'INSERT' OR a.id <> NEW.id);

  outstanding := sched.due_amount - sched.concession_amount - paid_on_schedule;

  IF NEW.amount > outstanding + 0.01 THEN
    RAISE EXCEPTION 'Allocation (%) exceeds the outstanding amount (%) for this fee row',
      NEW.amount, GREATEST(outstanding, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_fee_payment_allocation_trg ON public.fee_payment_allocations;
CREATE TRIGGER validate_fee_payment_allocation_trg
  BEFORE INSERT OR UPDATE ON public.fee_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_fee_payment_allocation();