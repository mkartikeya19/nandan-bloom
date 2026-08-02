CREATE TABLE public.opening_balance_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  academic_record_id uuid REFERENCES public.student_academic_records(id) ON DELETE SET NULL,
  academic_session_id uuid REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  session_label text,
  fee_head_id uuid REFERENCES public.fee_heads(id) ON DELETE SET NULL,
  fee_head_label text,
  amount numeric NOT NULL DEFAULT 0,
  remarks text,
  source text NOT NULL DEFAULT 'Manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opening_balance_details TO authenticated;
GRANT ALL ON public.opening_balance_details TO service_role;

ALTER TABLE public.opening_balance_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated with a role can view opening balance details"
ON public.opening_balance_details FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Admins can insert opening balance details"
ON public.opening_balance_details FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can update opening balance details"
ON public.opening_balance_details FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can delete opening balance details"
ON public.opening_balance_details FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE INDEX idx_obd_student ON public.opening_balance_details(student_id);
CREATE INDEX idx_obd_record ON public.opening_balance_details(academic_record_id);
CREATE INDEX idx_obd_session ON public.opening_balance_details(academic_session_id);

CREATE TRIGGER update_opening_balance_details_updated_at
BEFORE UPDATE ON public.opening_balance_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();