import { describe, expect, it } from "vitest";
import {
  allocatePayment,
  comparePriority,
  outstandingOf,
  priorityRank,
  formatINR,
  amountInWords,
  type ScheduleRow,
} from "@/lib/fees-helpers";

function row(p: Partial<ScheduleRow> & { id: string }): ScheduleRow {
  return {
    fee_head_id: "h",
    period_label: "x",
    period_month: null,
    period_year: null,
    due_amount: 0,
    concession_amount: 0,
    paid_amount: 0,
    status: "Pending",
    is_opening_balance: false,
    display_order: 0,
    sort_key: null,
    ...p,
  } as ScheduleRow;
}

describe("fee allocation priority", () => {
  const opening = row({ id: "ob", is_opening_balance: true, due_amount: 1000, sort_key: "0000-OPENING" });
  const admission = row({ id: "adm", fee_head_name: "Admission Fee", due_amount: 500, sort_key: "9-0001" });
  const activity = row({ id: "act", fee_head_name: "Activities Fee", due_amount: 300, sort_key: "9-0002" });
  const july = row({ id: "jul", fee_head_name: "Tuition Fee", period_month: 7, period_year: 2026, due_amount: 1000, sort_key: "2026-07-0001" });
  const jan = row({ id: "jan", fee_head_name: "Tuition Fee", period_month: 1, period_year: 2027, due_amount: 1000, sort_key: "2027-01-0001" });
  const library = row({ id: "lib", fee_head_name: "Library Fee", due_amount: 200, sort_key: "9-0005", fee_head_sort_order: 9 });
  const optional = row({ id: "opt", fee_head_name: "Transport", due_amount: 400, fee_head_frequency: "Optional" });

  it("ranks heads in business order", () => {
    expect(priorityRank(opening)).toBe(0);
    expect(priorityRank(admission)).toBe(1);
    expect(priorityRank(activity)).toBe(2);
    expect(priorityRank(july)).toBe(3);
    expect(priorityRank(library)).toBe(4);
    expect(priorityRank(optional)).toBe(5);
  });

  it("sorts monthly dues chronologically (July before January)", () => {
    const sorted = [jan, july].sort(comparePriority).map((r) => r.id);
    expect(sorted).toEqual(["jul", "jan"]);
  });

  it("allocates opening balance first, then admission, activity, monthly", () => {
    const rows = [july, optional, activity, admission, opening, jan];
    const allocs = allocatePayment(1900, rows);
    expect(allocs).toEqual([
      { scheduleId: "ob", amount: 1000 },
      { scheduleId: "adm", amount: 500 },
      { scheduleId: "act", amount: 300 },
      { scheduleId: "jul", amount: 100 },
    ]);
  });

  it("never allocates more than the outstanding amount", () => {
    const partly = row({ id: "p", due_amount: 1000, concession_amount: 200, paid_amount: 300, sort_key: "2026-07-0001", period_month: 7 });
    expect(outstandingOf(partly)).toBe(500);
    expect(allocatePayment(10_000, [partly])).toEqual([{ scheduleId: "p", amount: 500 }]);
  });

  it("skips fully settled and waived rows", () => {
    const settled = row({ id: "s", due_amount: 1000, paid_amount: 1000 });
    const waived = row({ id: "w", due_amount: 1000, concession_amount: 1000 });
    expect(allocatePayment(500, [settled, waived])).toEqual([]);
  });

  it("allocates nothing for a zero payment", () => {
    expect(allocatePayment(0, [july])).toEqual([]);
  });
});

describe("currency formatting", () => {
  it("formats Indian rupees", () => {
    expect(formatINR(125000)).toBe("₹1,25,000.00");
    expect(formatINR(null)).toBe("₹0.00");
  });

  it("spells amounts in words", () => {
    expect(amountInWords(0)).toBe("Zero Rupees Only");
    expect(amountInWords(1250)).toBe("One Thousand Two Hundred Fifty Rupees Only");
    expect(amountInWords(105000)).toBe("One Lakh Five Thousand Rupees Only");
  });
});
