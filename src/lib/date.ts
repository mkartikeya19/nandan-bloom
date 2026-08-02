/**
 * Standardised date formatting for the whole ERP.
 *
 * House style (Indian school convention):
 *   date      → 02 Aug 2026
 *   dateTime  → 02 Aug 2026, 4:30 pm
 *   monthYear → Aug 2026
 *   iso       → 2026-08-02 (database / Excel value)
 *
 * Never call `toLocaleDateString()` directly in components: the locale differs
 * between the SSR runtime and the browser, which causes hydration mismatches.
 */
import { format, isValid, parseISO } from "date-fns";

export type DateInput = string | number | Date | null | undefined;

export const DATE_FORMAT = "dd MMM yyyy";
export const DATE_TIME_FORMAT = "dd MMM yyyy, h:mm a";
export const MONTH_YEAR_FORMAT = "MMM yyyy";
export const ISO_DATE_FORMAT = "yyyy-MM-dd";

export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d =
    value instanceof Date ? value : typeof value === "number" ? new Date(value) : parseISO(value);
  return isValid(d) ? d : null;
}

function safeFormat(value: DateInput, pattern: string, fallback: string): string {
  const d = toDate(value);
  if (!d) return fallback;
  return format(d, pattern);
}

/** 02 Aug 2026 */
export function formatDate(value: DateInput, fallback = "—"): string {
  return safeFormat(value, DATE_FORMAT, fallback);
}

/** 02 Aug 2026, 4:30 pm */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  return safeFormat(value, DATE_TIME_FORMAT, fallback).replace(/\b(AM|PM)\b/, (m) =>
    m.toLowerCase(),
  );
}

/** Aug 2026 */
export function formatMonthYear(value: DateInput, fallback = "—"): string {
  return safeFormat(value, MONTH_YEAR_FORMAT, fallback);
}

/** 2026-08-02 — for database columns, form inputs and Excel exports. */
export function formatISODate(value: DateInput, fallback = ""): string {
  return safeFormat(value, ISO_DATE_FORMAT, fallback);
}

/** Today as 2026-08-02, safe for `<input type="date">` and query filters. */
export function todayISO(): string {
  return format(new Date(), ISO_DATE_FORMAT);
}
