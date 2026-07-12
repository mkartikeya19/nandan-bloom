import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "teacher" | "staff";

export function useUserRoles() {
  const query = useQuery({
    queryKey: ["current-user-roles"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return { userId: null as string | null, roles: [] as AppRole[] };
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return { userId: user.id, roles: (data ?? []).map((r) => r.role as AppRole) };
    },
    staleTime: 60_000,
  });

  const roles = query.data?.roles ?? [];
  return {
    ...query,
    userId: query.data?.userId ?? null,
    roles,
    isSuperAdmin: roles.includes("super_admin"),
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
  };
}
