import { describe, expect, it } from "vitest";
import { groupByScholar, sumBreakup, validateBreakup } from "@/lib/opening-balance";

describe("opening balance breakup", () => {
  it("sums breakup rows to the opening balance", () => {
    expect(
      sumBreakup([
        { session_label: "2024-2025", amount: 1200.5 },
        { session_label: "2024-2025", amount: 800.25 },
      ]),
    ).toBe(2000.75);
  });

  it("treats blank amounts as zero", () => {
    expect(sumBreakup([{ session_label: "x", amount: "" as unknown as number }])).toBe(0);
  });

  it("rejects empty, zero and session-less rows", () => {
    expect(validateBreakup([]).valid).toBe(false);
    expect(validateBreakup([{ session_label: "2024-2025", amount: 0 }]).errors[0]).toContain("greater than zero");
    expect(validateBreakup([{ amount: 100 }]).errors[0]).toContain("previous session");
  });

  it("accepts a valid breakup", () => {
    expect(validateBreakup([{ session_label: "2024-2025", amount: 500 }])).toEqual({ valid: true, errors: [] });
  });

  it("combines multiple imported rows per scholar into one balance", () => {
    const groups = groupByScholar([
      { scholar: "1002", session_label: "2024-2025", amount: 500 },
      { scholar: "1001", session_label: "2024-2025", amount: 1000 },
      { scholar: "1001", session_label: "2023-2024", amount: 250.5 },
      { scholar: "  ", session_label: "x", amount: 99 },
    ]);
    expect(groups.map((g) => g.scholar)).toEqual(["1001", "1002"]);
    expect(groups[0].total).toBe(1250.5);
    expect(groups[0].count).toBe(2);
  });
});
