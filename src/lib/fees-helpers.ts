import { supabase } from "@/integrations/supabase/client";

export const FEE_FREQUENCIES = ["Monthly", "Quarterly", "Annual", "One Time", "Optional"] as const;
export type FeeFrequency = (typeof FEE_FREQUENCIES)[number];

export const FEE_APPLICABILITIES = ["All", "NewAdmission", "Existing", "Optional"] as const;
export type FeeApplicability = (typeof FEE_APPLICABILITIES)[number];

export const FEE_APPLICABILITY_LABELS: Record<FeeApplicability, string> = {
  All: "All Students",
  NewAdmission: "New Admissions Only",
  Existing: "Existing Students Only",
  Optional: "Optional (manual)",
};

export const PAYMENT_MODES = [
  "Cash", "Cheque", "UPI", "NEFT", "RTGS", "IMPS", "Bank Transfer",
  "Debit Card", "Credit Card", "QR Code",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SCHEDULE_STATUSES = ["Pending", "Partial", "Paid", "Waived"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Tuition is generated July-April (never May/June)
export const DEFAULT_TUITION_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4];
export const BLOCKED_TUITION_MONTHS = [5, 6];


export function formatINR(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Number to Indian rupees in words
export function amountInWords(num: number): string {
  const n = Math.round(num);
  if (n === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (x: number): string => {
    if (x < 20) return a[x];
    if (x < 100) return b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
    if (x < 1000) return a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + inWords(x % 100) : "");
    return "";
  };
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(inWords(crore) + " Crore");
  if (lakh) parts.push(inWords(lakh) + " Lakh");
  if (thousand) parts.push(inWords(thousand) + " Thousand");
  if (rest) parts.push(inWords(rest));
  return parts.join(" ") + " Rupees Only";
}

export interface ScheduleRow {
  id: string;
  fee_head_id: string;
  period_label: string;
  period_month: number | null;
  period_year: number | null;
  due_amount: number;
  concession_amount: number;
  paid_amount: number;
  status: ScheduleStatus;
  is_opening_balance: boolean;
  display_order: number;
  sort_key: string | null;
  fee_head_name?: string;
  fee_head_sort_order?: number;
  fee_head_frequency?: string;
}

export interface AllocationDraft {
  scheduleId: string;
  amount: number;
}

/**
 * Business priority for chronological allocation:
 *  0 = Opening balance (previous session dues)
 *  1 = One-time / Annual mandatory heads (Admission, Activity, Practical, ...)
 *  2 = Monthly recurring (Tuition, SMF) — chronological
 *  3 = Optional fees
 */
export function priorityRank(r: ScheduleRow): number {
  if (r.is_opening_balance) return 0;
  const freq = (r.fee_head_frequency ?? "").toLowerCase();
  if (freq === "optional") return 3;
  if (r.period_month == null) return 1; // Annual / One Time
  return 2; // Monthly
}

export function comparePriority(a: ScheduleRow, b: ScheduleRow): number {
  const ra = priorityRank(a);
  const rb = priorityRank(b);
  if (ra !== rb) return ra - rb;
  // Within one-time: sort by fee_head sort_order then name
  if (ra === 1) {
    const so = (a.fee_head_sort_order ?? 999) - (b.fee_head_sort_order ?? 999);
    if (so !== 0) return so;
    return (a.fee_head_name ?? "").localeCompare(b.fee_head_name ?? "");
  }
  // Within monthly / opening / optional: chronological sort_key
  const ak = a.sort_key ?? "";
  const bk = b.sort_key ?? "";
  if (ak !== bk) return ak.localeCompare(bk);
  return a.display_order - b.display_order;
}

/**
 * Default payment allocator — respects business priority (opening → one-time →
 * monthly chronological → optional) so mandatory dues clear before recurring.
 */
export function allocatePayment(amount: number, rows: ScheduleRow[]): AllocationDraft[] {
  const sorted = [...rows].sort(comparePriority);
  let remaining = Math.max(0, Math.round(amount * 100) / 100);
  const result: AllocationDraft[] = [];
  for (const r of sorted) {
    if (remaining <= 0) break;
    const outstanding = Math.max(0, Number(r.due_amount) - Number(r.concession_amount) - Number(r.paid_amount));
    if (outstanding <= 0) continue;
    const alloc = Math.min(outstanding, remaining);
    result.push({ scheduleId: r.id, amount: Math.round(alloc * 100) / 100 });
    remaining = Math.round((remaining - alloc) * 100) / 100;
  }
  return result;
}

export function outstandingOf(r: Pick<ScheduleRow, "due_amount" | "concession_amount" | "paid_amount">) {
  return Math.max(0, Number(r.due_amount) - Number(r.concession_amount) - Number(r.paid_amount));
}

export async function generateStudentSchedule(recordId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("generate_student_fee_schedule", { _record_id: recordId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function nextReceiptNumber(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("next_receipt_number");
  if (error) throw error;
  return String(data);
}
