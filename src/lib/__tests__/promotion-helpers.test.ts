import { describe, expect, it } from "vitest";
import {
  eligibleDestinationSessions,
  resolveNextClass,
  resolveRetainClass,
  type ClassRow,
} from "@/lib/promotion-helpers";

const ladder: ClassRow[] = [
  { id: "n", name: "Nursery", order_index: 1 },
  { id: "1", name: "Class 1", order_index: 2 },
  { id: "2", name: "Class 2", order_index: 3 },
];

describe("student promotion", () => {
  it("promotes to the next class by order index", () => {
    expect(resolveNextClass(ladder[0], ladder)?.id).toBe("1");
    expect(resolveNextClass(ladder[1], ladder)?.id).toBe("2");
  });

  it("keeps the highest class for a terminal class", () => {
    expect(resolveNextClass(ladder[2], ladder)?.id).toBe("2");
  });

  it("falls back to the first class when the current class is unknown", () => {
    expect(resolveNextClass(null, ladder)?.id).toBe("n");
    expect(resolveNextClass(null, [])).toBeNull();
  });

  it("retains into the same-named class of the destination session", () => {
    expect(resolveRetainClass(ladder[1], ladder)?.id).toBe("1");
    expect(resolveRetainClass({ id: "x", name: "Class 9", order_index: 9 }, ladder)).toBeNull();
  });

  it("only offers chronologically later sessions", () => {
    const sessions = [
      { id: "a", name: "2025-2026", start_date: "2025-04-01" },
      { id: "b", name: "2026-2027", start_date: "2026-04-01" },
      { id: "c", name: "2027-2028", start_date: "2027-04-01" },
    ];
    expect(eligibleDestinationSessions(sessions, "b").map((s) => s.id)).toEqual(["c"]);
    expect(eligibleDestinationSessions(sessions, "a").map((s) => s.id)).toEqual(["b", "c"]);
    expect(eligibleDestinationSessions(sessions, null).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
