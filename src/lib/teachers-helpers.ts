import { supabase } from "@/integrations/supabase/client";

export const TEACHER_STATUS_VALUES = ["Active", "Inactive"] as const;
export type TeacherStatus = (typeof TEACHER_STATUS_VALUES)[number];

export const TEACHER_DOC_TYPES = [
  "Aadhaar Card",
  "PAN Card",
  "Bank Passbook / Cancelled Cheque",
  "Joining Letter",
  "Experience Certificate",
  "Passport Photograph",
  "Other Document",
] as const;
export type TeacherDocType = (typeof TEACHER_DOC_TYPES)[number];

export interface TeacherDocumentRow {
  id: string;
  teacher_id: string;
  doc_type: string;
  label: string | null;
  file_path: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = "teacher-documents";

export async function uploadTeacherFile(employeeCode: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${employeeCode}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getSignedTeacherUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function fetchNextEmployeeCode(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("next_employee_code");
  if (error) throw error;
  return String(data);
}

export function formatSalary(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

export function maskAccount(v: string | null | undefined): string {
  if (!v) return "—";
  const s = String(v);
  return s.length <= 4 ? s : `${"•".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}
