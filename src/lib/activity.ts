import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type ActivityModule =
  | "Students"
  | "Admissions"
  | "Fees"
  | "Attendance"
  | "Examinations"
  | "Users"
  | "Sessions"
  | "Settings"
  | "Promotion"
  | "Teachers";

export interface LogArgs {
  module: ActivityModule;
  action: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity log. Never throws — failures are swallowed so a
 * logging outage never blocks the primary operation.
 */
export async function logActivity({ module, action, entityType, entityId, details }: LogArgs): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    await supabase.from("activity_log").insert({
      user_id: userId,
      module,
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: (details ?? {}) as Json,
    });
  } catch {
    // swallow
  }
}
