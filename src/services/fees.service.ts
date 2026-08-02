import { supabase } from "@/integrations/supabase/client";
import type { ScheduleRow } from "@/lib/fees-helpers";

/**
 * Feature-scoped Supabase access for the Fee module.
 *
 * Route components should call these functions instead of embedding
 * `supabase.from(...)` chains, so query shapes stay in one place and are easy
 * to change when the schema evolves.
 */

export interface FeePaymentRow {
  id: string;
  receipt_number: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  is_void: boolean;
  remarks: string | null;
  student_id: string;
}

export async function fetchStudentSchedule(academicRecordId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from("student_fee_schedule")
    .select(
      "id, fee_head_id, period_label, period_month, period_year, due_amount, concession_amount, paid_amount, status, is_opening_balance, display_order, sort_key, fee_heads(name, sort_order, default_frequency)",
    )
    .eq("academic_record_id", academicRecordId)
    .order("sort_key", { ascending: true });
  if (error) throw error;

  type Joined = (typeof data extends (infer T)[] ? T : never) & {
    fee_heads?: { name: string; sort_order: number; default_frequency: string } | null;
  };

  return ((data ?? []) as Joined[]).map((r) => ({
    ...r,
    fee_head_name: r.fee_heads?.name,
    fee_head_sort_order: r.fee_heads?.sort_order,
    fee_head_frequency: r.fee_heads?.default_frequency,
  })) as ScheduleRow[];
}

export async function fetchStudentPayments(studentId: string): Promise<FeePaymentRow[]> {
  const { data, error } = await supabase
    .from("fee_payments")
    .select("id, receipt_number, amount, payment_mode, payment_date, is_void, remarks, student_id")
    .eq("student_id", studentId)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FeePaymentRow[];
}

export async function fetchReceipt(paymentId: string) {
  const { data, error } = await supabase
    .from("fee_payments")
    .select(
      "*, fee_payment_allocations(id, amount, student_fee_schedule(period_label, is_opening_balance, fee_heads(name)))",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function voidReceipt(paymentId: string, reason: string, userId: string | null) {
  const { error } = await supabase
    .from("fee_payments")
    .update({
      is_void: true,
      void_reason: reason,
      voided_by: userId,
      voided_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  if (error) throw error;
}

export async function fetchOpeningBalanceBreakup(studentId: string) {
  const { data, error } = await supabase
    .from("opening_balance_details")
    .select("id, session_label, fee_head_label, amount, remarks, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
