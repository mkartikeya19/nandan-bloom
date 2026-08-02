import { supabase } from "@/integrations/supabase/client";

/**
 * Feature-scoped Supabase access for the Student module.
 */

export interface StudentListRow {
  id: string;
  scholar_number: string;
  full_name: string;
  gender: string | null;
  status: string;
  father_name: string | null;
  guardian_phone: string | null;
}

export async function fetchStudents(): Promise<StudentListRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select("id, scholar_number, full_name, gender, status, father_name, guardian_phone")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as StudentListRow[];
}

export async function fetchStudent(studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchAcademicRecords(studentId: string) {
  const { data, error } = await supabase
    .from("student_academic_records")
    .select(
      "id, status, roll_number, opening_balance, fee_structure_id, academic_sessions(id, name, start_date, status), school_classes(id, name), school_sections(id, name), houses(id, name)",
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveSession() {
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("id, name, start_date, end_date, status")
    .eq("status", "Active")
    .maybeSingle();
  if (error) throw error;
  return data;
}
