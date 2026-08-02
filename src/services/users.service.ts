import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export interface CurrentUserRoles {
  userId: string | null;
  roles: AppRole[];
}

export async function fetchCurrentUserRoles(): Promise<CurrentUserRoles> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { userId: null, roles: [] };
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (error) throw error;
  return { userId: user.id, roles: (data ?? []).map((r) => r.role as AppRole) };
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export interface UserRoleRow {
  user_id: string;
  role: AppRole;
}

export async function fetchAllUserRoles(): Promise<UserRoleRow[]> {
  const { data, error } = await supabase.from("user_roles").select("user_id,role");
  if (error) throw error;
  return (data ?? []) as UserRoleRow[];
}

export async function addUserRoles(userId: string, roles: AppRole[]): Promise<void> {
  if (roles.length === 0) return;
  const { error } = await supabase
    .from("user_roles")
    .insert(roles.map((role) => ({ user_id: userId, role })));
  if (error) throw error;
}

export async function removeUserRoles(userId: string, roles: AppRole[]): Promise<void> {
  if (roles.length === 0) return;
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .in("role", roles);
  if (error) throw error;
}
