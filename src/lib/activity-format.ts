// Human-readable formatter for Activity Center rows.
// The raw JSON details are kept in the database; this only affects display.
import { formatINR } from "@/lib/fees-helpers";

type Details = Record<string, unknown> | null | undefined;

function s(d: Details, k: string): string | undefined {
  const v = d?.[k];
  return v == null ? undefined : String(v);
}
function n(d: Details, k: string): number | undefined {
  const v = d?.[k];
  return v == null || v === "" ? undefined : Number(v);
}

export function formatActivityDetails(
  module: string,
  action: string,
  details: Details,
): string {
  if (!details || Object.keys(details).length === 0) return "—";

  const a = action.toLowerCase();

  // Fees
  if (module === "Fees") {
    if (a.includes("payment") || a.includes("collect") || a.includes("receipt")) {
      const amt = n(details, "amount") ?? n(details, "total");
      const receipt = s(details, "receipt_number") ?? s(details, "receipt");
      const mode = s(details, "payment_mode") ?? s(details, "mode");
      const parts: string[] = [];
      if (amt != null) parts.push(`Collected ${formatINR(amt)}`);
      if (receipt) parts.push(`Receipt ${receipt}`);
      if (mode) parts.push(`Mode: ${mode}`);
      if (parts.length) return parts.join(" · ");
    }
    if (a.includes("void")) {
      const reason = s(details, "void_reason") ?? s(details, "reason");
      return reason ? `Receipt voided — ${reason}` : "Receipt voided";
    }
    if (a.includes("opening balance")) {
      const stu = s(details, "student_name") ?? s(details, "scholar_number");
      const amt = n(details, "amount");
      const rowsN = n(details, "breakup_rows");
      const mode = s(details, "entry_mode");
      const rem = s(details, "remarks");
      const bits: string[] = [];
      if (amt != null) bits.push(`Opening Balance ${formatINR(amt)}`);
      if (rowsN != null) bits.push(`${rowsN} breakup row${rowsN === 1 ? "" : "s"}`);
      if (mode) bits.push(mode);
      if (stu) bits.push(`for ${stu}`);
      if (rem) bits.push(rem);
      if (bits.length) return bits.join(" · ");
    }
    if (a.includes("orphan") || a.includes("linked fee structure") || a.includes("link fee")) {
      return "Linked fee structure and generated fee schedule";
    }
    if (a.includes("schedule")) {
      const c = n(details, "generated_count") ?? n(details, "count");
      return c != null ? `${c} schedule rows generated` : "Fee schedule updated";
    }
    if (a.includes("concession")) {
      const stu = s(details, "student_name") ?? s(details, "scholar_number");
      const amt = n(details, "amount");
      const type = s(details, "concession_type");
      const head = s(details, "fee_head");
      const parts: string[] = [];
      if (type) parts.push(type);
      if (amt != null) parts.push(formatINR(amt));
      if (head) parts.push(head);
      if (stu) parts.push(`for ${stu}`);
      if (parts.length) return parts.join(" · ");
    }
  }

  // Documents
  if (module === "Students" && a.includes("document")) {
    const doc = s(details, "document");
    const stu = s(details, "student_name") ?? s(details, "scholar_number");
    const bits: string[] = [];
    if (doc) bits.push(doc);
    if (stu) bits.push(`for ${stu}`);
    if (bits.length) return bits.join(" · ");
  }


  // Teachers (RC-3)
  if (module === "Teachers") {
    const code = s(details, "employee_code");
    const who = s(details, "full_name");
    const suffix = [who, code].filter(Boolean).join(" · ");
    if (a.includes("status")) {
      const from = s(details, "from");
      const to = s(details, "to");
      return `Status changed${from && to ? ` ${from} → ${to}` : ""}${suffix ? ` · ${suffix}` : ""}`;
    }
    if (a.includes("document")) {
      const doc = s(details, "document");
      const file = s(details, "file");
      return [doc, file, code].filter(Boolean).join(" · ") || "Document updated";
    }
    if (a.includes("archive")) return `Teacher archived${suffix ? ` — ${suffix}` : ""}`;
    if (a.includes("create")) return `Teacher created${suffix ? ` — ${suffix}` : ""}`;
    if (a.includes("update")) return `Teacher updated${suffix ? ` — ${suffix}` : ""}`;
  }


  // Students / Admissions
  if (module === "Students" || module === "Admissions") {
    if (a.includes("admit") || a.includes("create") || a.includes("new")) {
      const scholar = s(details, "scholar_number");
      const cls = s(details, "class_name") ?? s(details, "class");
      const parts = ["Student admitted"];
      if (scholar) parts.push(`Scholar No. ${scholar}`);
      if (cls) parts.push(`Class ${cls}`);
      return parts.join(" · ");
    }
    if (a.includes("edit") || a.includes("update")) {
      const scholar = s(details, "scholar_number");
      return scholar ? `Student updated (Scholar ${scholar})` : "Student updated";
    }
    if (a.includes("left") || a.includes("archive")) {
      return "Marked as Left / Archived";
    }
  }

  // Promotion
  if (module === "Promotion") {
    const promoted = n(details, "promoted");
    const retained = n(details, "retained");
    const left = n(details, "left");
    const schedules = n(details, "schedules_created");
    const bits: string[] = [];
    if (promoted != null) bits.push(`${promoted} promoted`);
    if (retained != null) bits.push(`${retained} retained`);
    if (left != null && left > 0) bits.push(`${left} left`);
    if (schedules != null) bits.push(`${schedules} fee schedules generated`);
    if (bits.length) return bits.join(" · ");
  }

  // Generic fallback: pull a few readable keys
  const readable = ["name", "full_name", "receipt_number", "scholar_number", "class_name", "amount"]
    .map((k) => (details[k] != null ? `${k.replace(/_/g, " ")}: ${details[k]}` : null))
    .filter(Boolean);
  if (readable.length) return readable.join(" · ");
  return "—";
}
