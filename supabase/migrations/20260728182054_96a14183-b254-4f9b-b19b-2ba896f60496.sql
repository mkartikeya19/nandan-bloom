DROP POLICY IF EXISTS "Super admins read teacher documents" ON storage.objects;
DROP POLICY IF EXISTS "Super admins write teacher documents" ON storage.objects;
DROP POLICY IF EXISTS "Super admins update teacher documents" ON storage.objects;
DROP POLICY IF EXISTS "Super admins delete teacher documents" ON storage.objects;

CREATE POLICY "Super admins read teacher documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'teacher-documents' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins write teacher documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'teacher-documents' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins update teacher documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'teacher-documents' AND public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'teacher-documents' AND public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins delete teacher documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'teacher-documents' AND public.has_role(auth.uid(), 'super_admin'));