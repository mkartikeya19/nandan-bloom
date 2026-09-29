import { describe, expect, it, vi } from "vitest";
import { executeUserDeletion, type UserDeletionDependencies } from "../user-deletion";

function dependencies(overrides: Partial<UserDeletionDependencies> = {}) {
  const calls: string[] = [];
  const deps: UserDeletionDependencies = {
    checkEligibility: vi.fn(async () => {
      calls.push("eligibility");
      return { deletable: true };
    }),
    getAuthUserState: vi
      .fn<() => Promise<{ exists: boolean; banned: boolean }>>()
      .mockImplementationOnce(async () => {
        calls.push("auth:initial");
        return { exists: true, banned: false };
      })
      .mockImplementationOnce(async () => {
        calls.push("auth:banned");
        return { exists: true, banned: true };
      }),
    banAuthUser: vi.fn(async () => void calls.push("auth:ban")),
    cleanupApplicationRecords: vi.fn(async () => {
      calls.push("app:cleanup");
      return { email: "target@example.test" };
    }),
    deleteAuthUser: vi.fn(async () => void calls.push("auth:delete")),
    finalizeDeletionAudit: vi.fn(async () => void calls.push("audit:final")),
    ...overrides,
  };
  return { calls, deps };
}

describe("user deletion orchestration", () => {
  it("writes the final event only after successful Auth deletion", async () => {
    const { calls, deps } = dependencies();
    await expect(executeUserDeletion(deps)).resolves.toMatchObject({
      email: "target@example.test",
      state: "User Deleted",
    });
    expect(calls).toEqual([
      "eligibility",
      "auth:initial",
      "auth:ban",
      "auth:banned",
      "app:cleanup",
      "auth:delete",
      "audit:final",
    ]);
  });

  it("leaves application state unchanged when the Auth ban fails", async () => {
    const { deps } = dependencies({
      banAuthUser: vi.fn(async () => {
        throw new Error("ban failed");
      }),
    });
    await expect(executeUserDeletion(deps)).rejects.toThrow("ban failed");
    expect(deps.cleanupApplicationRecords).not.toHaveBeenCalled();
    expect(deps.finalizeDeletionAudit).not.toHaveBeenCalled();
  });

  it("does not write a final event after an Auth deletion failure", async () => {
    const { deps } = dependencies({
      deleteAuthUser: vi.fn(async () => {
        throw new Error("delete failed");
      }),
    });
    await expect(executeUserDeletion(deps)).rejects.toThrow("delete failed");
    expect(deps.finalizeDeletionAudit).not.toHaveBeenCalled();
  });

  it("retries after Auth is already absent and preserves the cleanup snapshot", async () => {
    const { calls, deps } = dependencies({
      getAuthUserState: vi.fn(async () => {
        calls.push("auth:absent");
        return { exists: false, banned: false };
      }),
    });
    const result = await executeUserDeletion(deps);
    expect(result.email).toBe("target@example.test");
    expect(calls).toEqual(["eligibility", "auth:absent", "app:cleanup", "audit:final"]);
    expect(deps.banAuthUser).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
    expect(deps.finalizeDeletionAudit).toHaveBeenCalledTimes(1);
  });

  it("stops before Auth or application changes when eligibility denies deletion", async () => {
    const { deps } = dependencies({
      checkEligibility: vi.fn(async () => ({ deletable: false })),
    });
    await expect(executeUserDeletion(deps)).rejects.toThrow("operational history");
    expect(deps.getAuthUserState).not.toHaveBeenCalled();
    expect(deps.banAuthUser).not.toHaveBeenCalled();
    expect(deps.cleanupApplicationRecords).not.toHaveBeenCalled();
  });
});
