import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export const STUDENT_STATUS_VALUES = ["Active", "Left", "Passed Out", "Inactive"] as const;
export type StudentStatus = (typeof STUDENT_STATUS_VALUES)[number];

export const ADMISSION_TYPE_VALUES = [
  "New Admission",
  "Existing Student Migration",
  "Re-admission",
] as const;
export type AdmissionType = (typeof ADMISSION_TYPE_VALUES)[number];

export async function uploadStudentFile(
  scholarNumber: string,
  folder: "photos" | "documents",
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${folder}/${scholarNumber}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from("students").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function getSignedStudentUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("students").createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function fetchNextScholarNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_scholar_number");
  if (error) throw error;
  return String(data);
}

// ─── Excel template & parsing ────────────────────────────────────────────

export const IMPORT_COLUMNS = [
  "Scholar Number",
  "Full Name",
  "Gender",
  "Date of Birth (YYYY-MM-DD)",
  "Date of Admission (YYYY-MM-DD)",
  "Aadhaar Number",
  "APAAR ID",
  "PEN ID",
  "Samagra ID",
  "Nationality",
  "Religion",
  "Category",
  "Caste",
  "Blood Group",
  "Mother Tongue",
  "Father Name",
  "Father Mobile",
  "Father Occupation",
  "Father Email",
  "Mother Name",
  "Mother Mobile",
  "Mother Occupation",
  "Mother Email",
  "Guardian Name",
  "Guardian Mobile",
  "Emergency Contact Name",
  "Emergency Contact Number",
  "Address",
  "City",
  "State",
  "PIN Code",
  "Academic Session",
  "Class",
  "Section",
  "Roll Number",
  "House",
  "Joined On (YYYY-MM-DD)",
] as const;

export function downloadImportTemplate() {
  const example: Record<string, string> = {};
  IMPORT_COLUMNS.forEach((c) => (example[c] = ""));
  example["Scholar Number"] = "1001";
  example["Full Name"] = "Aarav Sharma";
  example["Gender"] = "male";
  example["Date of Admission (YYYY-MM-DD)"] = new Date().toISOString().slice(0, 10);
  example["Academic Session"] = "2025-2026";
  example["Class"] = "Class 1";
  example["Section"] = "A";
  example["Joined On (YYYY-MM-DD)"] = new Date().toISOString().slice(0, 10);

  const ws = XLSX.utils.json_to_sheet([example], { header: [...IMPORT_COLUMNS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "student-import-template.xlsx");
}

export type RawRow = Record<string, string | number | Date | undefined>;

export type ParsedWorkbook = {
  rows: RawRow[];
  /** True when the workbook uses the 1904 date system (classic Mac Excel). */
  date1904: boolean;
};

export function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // cellDates keeps true date cells as Date objects; serials still arrive
        // as numbers and are normalised downstream.
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: true });
        const date1904 = Boolean(
          (wb.Workbook?.WBProps as { date1904?: boolean | number } | undefined)?.date1904,
        );
        resolve({ rows, date1904 });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
