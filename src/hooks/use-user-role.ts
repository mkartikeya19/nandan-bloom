import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUserRoles } from "@/services/users.service";
import { buildPermissions, type Permissions } from "@/lib/permissions";

export type { AppRole } from "@/lib/permissions";

/**
 * Current user's roles + the derived permission set.
 * All permission logic lives in `@/lib/permissions` — do not add role checks here.
 */
export function useUserRoles(): ReturnType<typeof useQuery<{ userId: string | null; roles: string[] }>> &
  Permissions & { userId: string | null } {
  const query = useQuery({
    queryKey: ["current-user-roles"],
    queryFn: fetchCurrentUserRoles,
    staleTime: 60_000,
  });

  return {
    ...query,
    userId: query.data?.userId ?? null,
    ...buildPermissions(query.data?.roles),
  } as ReturnType<typeof useQuery<{ userId: string | null; roles: string[] }>> &
    Permissions & { userId: string | null };
}
