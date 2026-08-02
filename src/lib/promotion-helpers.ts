/**
 * Pure promotion helpers — no Supabase access, so they can be unit tested.
 */

export interface ClassRow {
  id: string;
  name: string;
  order_index: number;
}

export interface SessionRow {
  id: string;
  name: string;
  start_date: string;
}

/**
 * Destination class for a promoted student: the next class by `order_index`
 * in the destination session. Falls back to a same-named class (useful when
 * the destination session has a different ladder), then to the first class.
 * Returns `null` when the destination session has no classes at all.
 */
export function resolveNextClass(
  current: ClassRow | undefined | null,
  destinationClasses: readonly ClassRow[],
): ClassRow | null {
  const sorted = [...destinationClasses].sort((a, b) => a.order_index - b.order_index);
  if (sorted.length === 0) return null;
  if (!current) return sorted[0];
  return (
    sorted.find((c) => c.order_index > current.order_index) ??
    sorted.find((c) => c.name === current.name) ??
    sorted[sorted.length - 1]
  );
}

/** Class the student stays in when the action is "retain". */
export function resolveRetainClass(
  current: ClassRow | undefined | null,
  destinationClasses: readonly ClassRow[],
): ClassRow | null {
  if (!current) return null;
  return destinationClasses.find((c) => c.name === current.name) ?? null;
}

/**
 * Sessions that may follow `currentSessionId`, chronologically. Promotion is
 * always forward in time — you can never promote into the current or an
 * earlier session.
 */
export function eligibleDestinationSessions(
  sessions: readonly SessionRow[],
  currentSessionId: string | null,
): SessionRow[] {
  const ordered = [...sessions].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const current = ordered.find((s) => s.id === currentSessionId);
  if (!current) return ordered;
  return ordered.filter((s) => s.start_date > current.start_date);
}
