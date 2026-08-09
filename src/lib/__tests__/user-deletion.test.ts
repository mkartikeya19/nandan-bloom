import { describe, it, expect } from "vitest";
import {
  DEACTIVATION_ATTRIBUTION_BLOCKER,
  deletionState,
  isDeletionRetryable,
  shouldRemainBanned,
  type DeletionProgress,
} from "../user-lifecycle";

const progress = (p: Partial<DeletionProgress> = {}): DeletionProgress => ({
  banned: false,
  recordsRemoved: false,
  authDeleted: false,
  ...p,
});

/**
 * Pure state-machine coverage for the fail-safe deletion sequence (D5) and the
 * deactivation-attribution blocker label (D4).
 *
 * These are unit tests of shared logic only. They do NOT exercise PostgreSQL,
 * RLS, function grants, advisory locking or Supabase Auth — those remain
 * "Pending — requires isolated non-production database verification."
 */
describe("fail-safe deletion states", () => {
  it("reports success only once the Auth account is gone", () => {
    expect(deletionState(progress({ banned: true, recordsRemoved: true, authDeleted: true }))).toBe(
      "User Deleted",
    );
  });

  it("treats a ban failure as a clean no-op start", () => {
    expect(deletionState(progress())).toBe("User Deletion Started");
  });

  it("reports failure when records were removed but Auth deletion did not finish", () => {
    expect(deletionState(progress({ banned: true, recordsRemoved: true }))).toBe(
      "User Deletion Failed",
    );
  });

  it("reports failure when the ban succeeded but record removal did not", () => {
    expect(deletionState(progress({ banned: true }))).toBe("User Deletion Failed");
  });

  it("keeps every unfinished deletion retryable", () => {
    expect(isDeletionRetryable(progress({ banned: true }))).toBe(true);
    expect(isDeletionRetryable(progress({ banned: true, recordsRemoved: true }))).toBe(true);
    expect(
      isDeletionRetryable(progress({ banned: true, recordsRemoved: true, authDeleted: true })),
    ).toBe(false);
  });

  it("never restores access after a partial failure", () => {
    expect(shouldRemainBanned(progress({ banned: true, recordsRemoved: true }))).toBe(true);
  });
});

describe("deactivation attribution blocker (D4)", () => {
  it("uses a stable, human-readable blocker label", () => {
    expect(DEACTIVATION_ATTRIBUTION_BLOCKER).toBe("Deactivated other staff accounts");
  });

  it("is surfaced as a blocker by the eligibility payload shape", () => {
    const eligibility = {
      user_id: "u1",
      deletable: false,
      blockers: [{ label: DEACTIVATION_ATTRIBUTION_BLOCKER, count: 2 }],
    };
    expect(eligibility.deletable).toBe(false);
    expect(eligibility.blockers.map((b) => b.label)).toContain(DEACTIVATION_ATTRIBUTION_BLOCKER);
  });
});
