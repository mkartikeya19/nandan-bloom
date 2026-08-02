/**
 * Receipt lifecycle helpers (pure — unit tested).
 *
 * Receipts are immutable: a mistake is corrected by voiding and re-posting.
 * Voiding reverses every allocation of that receipt; the database triggers
 * `recompute_on_payment_void` / `recompute_schedule_paid` do this server-side.
 * The functions below mirror that arithmetic so the UI can preview the effect
 * and so the rules are covered by tests.
 */
import type { ScheduleStatus } from "./fees-helpers";

export interface ScheduleAmounts {
  id: string;
  due_amount: number;
  concession_amount: number;
  paid_amount: number;
}

export interface Allocation {
  student_fee_schedule_id: string;
  amount: number;
}

function round(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Same CASE expression as the database trigger. */
export function computeScheduleStatus(row: ScheduleAmounts): ScheduleStatus {
  const net = round(Number(row.due_amount) - Number(row.concession_amount));
  const paid = round(Number(row.paid_amount));
  if (net <= 0) return "Waived";
  if (paid >= net) return "Paid";
  if (paid > 0) return "Partial";
  return "Pending";
}

/** Outstanding amount on a single fee schedule row. */
export function outstanding(row: ScheduleAmounts): number {
  return Math.max(
    0,
    round(Number(row.due_amount) - Number(row.concession_amount) - Number(row.paid_amount)),
  );
}

/** Ledger state after voiding a receipt: every allocation is reversed. */
export function applyVoid(
  schedule: readonly ScheduleAmounts[],
  allocations: readonly Allocation[],
): ScheduleAmounts[] {
  const reversal = new Map<string, number>();
  for (const a of allocations) {
    reversal.set(
      a.student_fee_schedule_id,
      round((reversal.get(a.student_fee_schedule_id) ?? 0) + Number(a.amount)),
    );
  }
  return schedule.map((row) => ({
    ...row,
    paid_amount: Math.max(0, round(Number(row.paid_amount) - (reversal.get(row.id) ?? 0))),
  }));
}

export interface VoidGuard {
  allowed: boolean;
  reason?: string;
}

/** Business rules for the Void Receipt action. */
export function canVoidReceipt(
  receipt: { is_void: boolean },
  perms: { canVoidReceipt: boolean },
  reason: string,
): VoidGuard {
  if (!perms.canVoidReceipt) return { allowed: false, reason: "Only Admin / Super Admin can void a receipt." };
  if (receipt.is_void) return { allowed: false, reason: "This receipt is already void." };
  if (reason.trim().length < 5) return { allowed: false, reason: "A void reason of at least 5 characters is required." };
  return { allowed: true };
}
