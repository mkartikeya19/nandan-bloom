import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/permissions";

export interface InvitationRow {
  id: string;
  email: string;
  roles: AppRole[];
  full_name: string | null;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type InvitationStatus = "Pending" | "Accepted" | "Revoked" | "Expired";

export function invitationStatus(
  inv: Pick<InvitationRow, "accepted_at" | "revoked_at" | "expires_at">,
  now: Date = new Date(),
): InvitationStatus {
  if (inv.accepted_at) return "Accepted";
  if (inv.revoked_at) return "Revoked";
  if (new Date(inv.expires_at).getTime() <= now.getTime()) return "Expired";
  return "Pending";
}

export async function fetchInvitations(): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from("user_invitations")
    .select("id,email,roles,full_name,invited_by,expires_at,accepted_at,revoked_at,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvitationRow[];
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from("user_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
