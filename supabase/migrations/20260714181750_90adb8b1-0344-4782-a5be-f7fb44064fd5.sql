REVOKE EXECUTE ON FUNCTION public.is_fee_structure_complete(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_complete_fee_structure(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_active_academic_record_fee_structure() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.is_fee_structure_complete(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.find_complete_fee_structure(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_fee_structure_complete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_complete_fee_structure(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_active_academic_record_fee_structure() TO service_role;
GRANT EXECUTE ON FUNCTION public.admit_student_with_fee_structure(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_academic_record_fee_structure(uuid) TO service_role;