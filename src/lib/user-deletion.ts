export interface DeletionEligibility {
  deletable: boolean;
}

export interface AuthUserState {
  exists: boolean;
  banned: boolean;
}

export interface ApplicationCleanupResult {
  email: string | null;
}

export interface UserDeletionDependencies {
  checkEligibility: () => Promise<DeletionEligibility>;
  getAuthUserState: () => Promise<AuthUserState>;
  banAuthUser: () => Promise<void>;
  cleanupApplicationRecords: () => Promise<ApplicationCleanupResult>;
  deleteAuthUser: () => Promise<void>;
  finalizeDeletionAudit: () => Promise<void>;
}

/**
 * Coordinates deletion across application records and the external Auth
 * account. Durable retry state and final-event idempotency are enforced by the
 * database functions called by these dependencies.
 */
export async function executeUserDeletion(deps: UserDeletionDependencies) {
  const eligibility = await deps.checkEligibility();
  if (!eligibility.deletable) {
    throw new Error("This account has operational history and cannot be deleted.");
  }

  const initialAuth = await deps.getAuthUserState();
  let cleanup: ApplicationCleanupResult;

  if (initialAuth.exists) {
    // No application state changes before the Auth ban is confirmed.
    await deps.banAuthUser();
    const bannedAuth = await deps.getAuthUserState();
    if (!bannedAuth.exists || !bannedAuth.banned) {
      throw new Error(
        "User Deletion Failed — the login could not be confirmed as disabled. No records were removed.",
      );
    }

    cleanup = await deps.cleanupApplicationRecords();
    await deps.deleteAuthUser();
  } else {
    // Auth may already be gone when a prior final-audit call failed. Cleanup is
    // idempotent and rejects this path unless a profile or durable job exists.
    cleanup = await deps.cleanupApplicationRecords();
  }

  // Service-only and idempotent; called only after Auth is confirmed absent.
  await deps.finalizeDeletionAudit();

  return {
    email: cleanup.email,
    deleted: true as const,
    state: "User Deleted" as const,
  };
}
