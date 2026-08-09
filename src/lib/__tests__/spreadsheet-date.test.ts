import { describe, expect, it } from "vitest";
import { normalizeSpreadsheetDate } from "../spreadsheet-date";

const ok = (v: unknown, opts = {}) => normalizeSpreadsheetDate(v, opts);

describe("normalizeSpreadsheetDate", () => {
  it("converts Excel 1900 serials", () => {
    expect(ok(43650)).toEqual({ ok: true, value: "2019-07-04" });
    expect(ok("43650")).toEqual({ ok: true, value: "2019-07-04" });
    expect(ok(1)).toEqual({ ok: true, value: "1900-01-01" });
    expect(ok(61)).toEqual({ ok: true, value: "1900-03-01" });
  });

  it("respects the 1904 date system", () => {
    expect(ok(0, { date1904: true })).toEqual({ ok: true, value: "1904-01-01" });
    expect(ok(42188, { date1904: true })).toEqual({ ok: true, value: "2019-07-04" });
  });

  it("discards the time component of fractional serials", () => {
    expect(ok(43650.75)).toEqual({ ok: true, value: "2019-07-04" });
  });

  it("parses explicit textual formats without MM/DD ambiguity", () => {
    expect(ok("04/07/2019")).toEqual({ ok: true, value: "2019-07-04" });
    expect(ok("4-7-2019")).toEqual({ ok: true, value: "2019-07-04" });
    expect(ok("2019-07-04")).toEqual({ ok: true, value: "2019-07-04" });
  });

  it("treats blanks as no date", () => {
    expect(ok("")).toEqual({ ok: true, value: null });
    expect(ok(null)).toEqual({ ok: true, value: null });
    expect(ok(undefined)).toEqual({ ok: true, value: null });
  });

  it("rejects impossible and out-of-range values", () => {
    for (const bad of [
      "31/02/2020",
      "29/02/2019",
      "32/01/2020",
      "xyz",
      "436500",
      -5,
      NaN,
      Infinity,
    ])
      expect(ok(bad).ok).toBe(false);
  });

  it("keeps Date objects on their calendar day", () => {
    expect(ok(new Date(2019, 6, 4))).toEqual({ ok: true, value: "2019-07-04" });
  });
});
