/**
 * Opening balance migration helpers (pure — unit tested).
 *
 * A student's Opening Balance is a single amount on their academic record.
 * The breakup rows in `opening_balance_details` explain how it was arrived at
 * and must always sum to that amount.
 */

export interface BreakupRow {
  session_label?: string | null;
  fee_head_label?: string | null;
  fee_head_id?: string | null;
  academic_session_id?: string | null;
  amount: number | string;
  remarks?: string | null;
}

export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Sum of a breakup — this becomes the student's Opening Balance. */
export function sumBreakup(rows: readonly BreakupRow[]): number {
  return roundMoney(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
}

export interface BreakupValidation {
  valid: boolean;
  errors: string[];
}

export function validateBreakup(rows: readonly BreakupRow[]): BreakupValidation {
  const errors: string[] = [];
  if (rows.length === 0) errors.push("Add at least one breakup row.");
  rows.forEach((r, i) => {
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      errors.push(`Row ${i + 1}: amount must be greater than zero.`);
    }
    if (!r.session_label && !r.academic_session_id) {
      errors.push(`Row ${i + 1}: previous session is required.`);
    }
  });
  const total = sumBreakup(rows);
  if (rows.length > 0 && total <= 0)
    errors.push("Total opening balance must be greater than zero.");
  return { valid: errors.length === 0, errors };
}

export interface ImportedBreakupRow extends BreakupRow {
  scholar: string;
}

export interface ScholarGroup<T extends ImportedBreakupRow = ImportedBreakupRow> {
  scholar: string;
  total: number;
  count: number;
  rows: T[];
}

/**
 * Group imported Excel rows by scholar number. Multiple rows per scholar are
 * combined — their sum becomes that student's single Opening Balance.
 */
export function groupByScholar<T extends ImportedBreakupRow>(
  rows: readonly T[],
): ScholarGroup<T>[] {
  const map = new Map<string, ScholarGroup<T>>();
  for (const r of rows) {
    const key = String(r.scholar ?? "").trim();
    if (!key) continue;
    const g: ScholarGroup<T> = map.get(key) ?? { scholar: key, total: 0, count: 0, rows: [] };
    g.rows.push(r);
    g.count += 1;
    g.total = roundMoney(g.total + (Number(r.amount) || 0));
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.scholar.localeCompare(b.scholar));
}
