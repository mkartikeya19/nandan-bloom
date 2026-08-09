import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export interface CurrentUserRoles {
  userId: string | null;
  roles: AppRole[];
  isActive: boolean;
}

export async function fetchCurrentUserRoles(): Promise<CurrentUserRoles> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { userId: null, roles: [], isActive: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();
  const isActive = profile?.is_active ?? true;

  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (error) throw error;
  return {
    userId: user.id,
    // A deactivated account holds no effective roles anywhere — the database
    // enforces this too (`has_role` and every read policy check `is_active`).
    roles: isActive ? (data ?? []).map((r) => r.role as AppRole) : [],
    isActive,
  };
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  deactivation_reason: string | null;
}

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,phone,is_active,deactivated_at,deactivation_reason")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
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
