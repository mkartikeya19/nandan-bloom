/**
 * Single source of truth for converting spreadsheet cell values into
 * PostgreSQL-safe `YYYY-MM-DD` date strings.
 *
 * Supported inputs:
 *  - JavaScript `Date` objects (as produced by SheetJS `cellDates`)
 *  - Excel numeric serials (1900 or 1904 date system)
 *  - Excel serials given as strings, e.g. "43650"
 *  - DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
 *  - blank / null / undefined → `null` (valid, means "no date")
 *
 * Anything else is rejected. The same helper is used for validation and for
 * building the import payload, so a row that validates cannot fail in the DB.
 */

export type SpreadsheetDateResult =
  | { ok: true; value: string | null }
  | { ok: false; raw: string; reason: string };

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function fromParts(year: number, month: number, day: number): SpreadsheetDateResult {
  const raw = `${year}-${month}-${day}`;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { ok: false, raw, reason: "not a calendar date" };
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false, raw, reason: "out of range" };
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { ok: false, raw, reason: "year out of supported range" };
  }
  // Verify the calendar components round-trip (rejects 31/02, 29/02 non-leap…)
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { ok: false, raw, reason: "impossible calendar date" };
  }
  return { ok: true, value: `${pad(year, 4)}-${pad(month)}-${pad(day)}` };
}

/** Excel serial → date, using UTC arithmetic so no timezone shift occurs. */
function fromExcelSerial(serialInput: number, date1904: boolean): SpreadsheetDateResult {
  const raw = String(serialInput);
  if (!Number.isFinite(serialInput)) return { ok: false, raw, reason: "not a number" };
  // Discard any time component; only whole days are meaningful here.
  const serial = Math.floor(serialInput);
  if (serial < 0 || (serial === 0 && !date1904))
    return { ok: false, raw, reason: "negative or zero serial" };

  let epochUTC: number;
  if (date1904) {
    epochUTC = Date.UTC(1904, 0, 1);
  } else {
    // Excel's 1900 system wrongly treats 1900 as a leap year. Serials >= 61
    // (1 March 1900 onwards) are offset by one day; earlier serials are not.
    epochUTC = serial < 61 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  }
  const ms = epochUTC + serial * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return { ok: false, raw, reason: "invalid serial" };
  return fromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function normalizeSpreadsheetDate(
  input: unknown,
  opts: { date1904?: boolean } = {},
): SpreadsheetDateResult {
  const date1904 = opts.date1904 === true;

  if (input === null || input === undefined) return { ok: true, value: null };

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return { ok: false, raw: "Invalid Date", reason: "invalid" };
    // SheetJS emits dates in local time; read the local components so the
    // calendar day the user typed is preserved (no timezone shift).
    return fromParts(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }

  if (typeof input === "number") return fromExcelSerial(input, date1904);

  if (typeof input !== "string") {
    return { ok: false, raw: String(input), reason: "unsupported value" };
  }

  const s = input.trim();
  if (!s) return { ok: true, value: null };

  // YYYY-MM-DD (also accepts YYYY/MM/DD)
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return fromParts(Number(m[1]), Number(m[2]), Number(m[3]));

  // DD/MM/YYYY or DD-MM-YYYY (never MM/DD/YYYY)
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return fromParts(Number(m[3]), Number(m[2]), Number(m[1]));

  // Excel serial written as text, e.g. "43650"
  if (/^\d+(\.\d+)?$/.test(s)) return fromExcelSerial(Number(s), date1904);

  return { ok: false, raw: s, reason: "unrecognised date format" };
}

/** Convenience: normalized value or `null` when blank/invalid (validation reports the error). */
export function toIsoDateOrNull(input: unknown, opts: { date1904?: boolean } = {}): string | null {
  const r = normalizeSpreadsheetDate(input, opts);
  return r.ok ? r.value : null;
}
