import { describe, expect, it } from "vitest";
import { applyVoid, canVoidReceipt, computeScheduleStatus, outstanding } from "@/lib/receipts";

const schedule = [
  { id: "a", due_amount: 1000, concession_amount: 0, paid_amount: 1000 },
  { id: "b", due_amount: 1000, concession_amount: 0, paid_amount: 400 },
];

describe("receipt voiding", () => {
  it("reverses every allocation of the voided receipt", () => {
    const after = applyVoid(schedule, [
      { student_fee_schedule_id: "a", amount: 1000 },
      { student_fee_schedule_id: "b", amount: 400 },
    ]);
    expect(after.map((r) => r.paid_amount)).toEqual([0, 0]);
    expect(after.map(computeScheduleStatus)).toEqual(["Pending", "Pending"]);
  });

  it("leaves untouched rows alone and never goes negative", () => {
    const after = applyVoid(schedule, [{ student_fee_schedule_id: "a", amount: 5000 }]);
    expect(after[0].paid_amount).toBe(0);
    expect(after[1].paid_amount).toBe(400);
  });

  it("recomputes status exactly like the database trigger", () => {
    expect(computeScheduleStatus({ id: "x", due_amount: 500, concession_amount: 500, paid_amount: 0 })).toBe("Waived");
    expect(computeScheduleStatus({ id: "x", due_amount: 500, concession_amount: 0, paid_amount: 500 })).toBe("Paid");
    expect(computeScheduleStatus({ id: "x", due_amount: 500, concession_amount: 0, paid_amount: 200 })).toBe("Partial");
    expect(computeScheduleStatus({ id: "x", due_amount: 500, concession_amount: 0, paid_amount: 0 })).toBe("Pending");
    expect(outstanding({ id: "x", due_amount: 500, concession_amount: 100, paid_amount: 200 })).toBe(200);
  });

  it("guards the void action", () => {
    const perms = { canVoidReceipt: true };
    expect(canVoidReceipt({ is_void: false }, { canVoidReceipt: false }, "wrong amount").allowed).toBe(false);
    expect(canVoidReceipt({ is_void: true }, perms, "wrong amount").allowed).toBe(false);
    expect(canVoidReceipt({ is_void: false }, perms, "typo").allowed).toBe(false);
    expect(canVoidReceipt({ is_void: false }, perms, "wrong amount").allowed).toBe(true);
  });
});
