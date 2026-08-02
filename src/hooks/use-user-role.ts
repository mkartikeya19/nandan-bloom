import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchCurrentUserRoles, type CurrentUserRoles } from "@/services/users.service";
import { buildPermissions, type Permissions } from "@/lib/permissions";

export type { AppRole } from "@/lib/permissions";

export type UseUserRolesResult = UseQueryResult<CurrentUserRoles, Error> &
  Permissions & { userId: string | null };

/**
 * Current user's roles plus the derived permission set.
 * All permission logic lives in `@/lib/permissions` — do not add role checks here.
 */
export function useUserRoles(): UseUserRolesResult {
  const query = useQuery<CurrentUserRoles, Error>({
    queryKey: ["current-user-roles"],
    queryFn: fetchCurrentUserRoles,
    staleTime: 60_000,
  });

  return {
    ...query,
    userId: query.data?.userId ?? null,
    ...buildPermissions(query.data?.roles),
  } as UseUserRolesResult;
}
