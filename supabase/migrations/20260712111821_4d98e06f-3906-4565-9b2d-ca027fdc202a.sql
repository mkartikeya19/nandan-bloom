
CREATE EXTENSION IF NOT EXISTS citext;

-- school_profile
CREATE TABLE public.school_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT, city TEXT, state TEXT, pincode TEXT,
  phone TEXT, email TEXT, website TEXT,
  udise_code TEXT, affiliation_board TEXT, affiliation_number TEXT,
  principal_name TEXT, established_year INT, logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_profile TO authenticated;
GRANT ALL ON public.school_profile TO service_role;
ALTER TABLE public.school_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_profile select" ON public.school_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "school_profile insert" ON public.school_profile FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school_profile update" ON public.school_profile FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school_profile delete" ON public.school_profile FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_updated_at_school_profile BEFORE UPDATE ON public.school_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- academic_sessions
CREATE TABLE public.academic_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name CITEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
CREATE UNIQUE INDEX academic_sessions_one_active ON public.academic_sessions ((is_active)) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_sessions TO authenticated;
GRANT ALL ON public.academic_sessions TO service_role;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "academic_sessions select" ON public.academic_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "academic_sessions insert" ON public.academic_sessions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "academic_sessions update" ON public.academic_sessions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "academic_sessions delete" ON public.academic_sessions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_updated_at_academic_sessions BEFORE UPDATE ON public.academic_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- school_classes
CREATE TABLE public.school_classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  name CITEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_classes TO authenticated;
GRANT ALL ON public.school_classes TO service_role;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_classes select" ON public.school_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "school_classes insert" ON public.school_classes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school_classes update" ON public.school_classes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school_classes delete" ON public.school_classes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_updated_at_school_classes BEFORE UPDATE ON public.school_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- school_sections
CREATE TABLE public.school_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  name CITEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_sections TO authenticated;
GRANT ALL ON public.school_sections TO service_role;
ALTER TABLE public.school_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_sections select" ON public.school_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "school_sections insert" ON public.school_sections FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school_sections update" ON public.school_sections FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "school_sections delete" ON public.school_sections FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_updated_at_school_sections BEFORE UPDATE ON public.school_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- houses
CREATE TABLE public.houses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name CITEXT NOT NULL UNIQUE,
  color TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.houses TO authenticated;
GRANT ALL ON public.houses TO service_role;
ALTER TABLE public.houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houses select" ON public.houses FOR SELECT TO authenticated USING (true);
CREATE POLICY "houses insert" ON public.houses FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "houses update" ON public.houses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "houses delete" ON public.houses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_updated_at_houses BEFORE UPDATE ON public.houses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- fee_heads
CREATE TABLE public.fee_heads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name CITEXT NOT NULL UNIQUE,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  default_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_heads TO authenticated;
GRANT ALL ON public.fee_heads TO service_role;
ALTER TABLE public.fee_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_heads select" ON public.fee_heads FOR SELECT TO authenticated USING (true);
CREATE POLICY "fee_heads insert" ON public.fee_heads FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "fee_heads update" ON public.fee_heads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "fee_heads delete" ON public.fee_heads FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER set_updated_at_fee_heads BEFORE UPDATE ON public.fee_heads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Super admin management of users
CREATE POLICY "user_roles super_admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "profiles super_admin update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
