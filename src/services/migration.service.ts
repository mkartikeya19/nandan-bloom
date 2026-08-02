import { supabase } from "@/integrations/supabase/client";

// ─── Migration batches ───────────────────────────────────────────────────

export type MigrationBatchType = "students" | "opening_balances" | "teachers";

export type MigrationEntityType =
  | "student"
  | "student_academic_record"
  | "opening_balance_detail"
  | "teacher";

export interface MigrationBatch {
  id: string;
  batch_type: string;
  label: string | null;
  record_count: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  rolled_back_at: string | null;
}

export interface MigrationBatchItemInput {
  entity_type: MigrationEntityType;
  entity_id: string;
  entity_label?: string | null;
}

export async function createMigrationBatch(
  batchType: MigrationBatchType,
  label: string,
): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("migration_batches")
    .insert({ batch_type: batchType, label, created_by: userData.user?.id ?? null })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

export async function recordBatchItems(
  batchId: string,
  items: MigrationBatchItemInput[],
): Promise<void> {
  if (!batchId || items.length === 0) return;
  await supabase.from("migration_batch_items").insert(
    items.map((i) => ({
      batch_id: batchId,
      entity_type: i.entity_type,
      entity_id: i.entity_id,
      entity_label: i.entity_label ?? null,
    })),
  );
  await supabase.from("migration_batches").update({ record_count: items.length }).eq("id", batchId);
}

export async function fetchMigrationBatches(): Promise<MigrationBatch[]> {
  const { data, error } = await supabase
    .from("migration_batches")
    .select("id, batch_type, label, record_count, notes, created_by, created_at, rolled_back_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as MigrationBatch[];
}

export async function rollbackMigrationBatch(batchId: string): Promise<void> {
  const { error } = await supabase.rpc("rollback_migration_batch", { _batch_id: batchId });
  if (error) throw error;
}

// ─── Go-live validation ──────────────────────────────────────────────────

export interface GoLiveCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface GoLiveResult {
  ready: boolean;
  failures: number;
  active_students: number;
  checks: GoLiveCheck[];
  generated_at: string;
}

export async function runGoLiveValidation(): Promise<GoLiveResult> {
  const { data, error } = await supabase.rpc("go_live_validation");
  if (error) throw error;
  return data as unknown as GoLiveResult;
}

// ─── Migration progress dashboard ────────────────────────────────────────

export interface ProgressRow {
  module: string;
  imported: number;
  prerequisite?: string;
}

async function countRows(
  table:
    | "academic_sessions"
    | "school_classes"
    | "school_sections"
    | "houses"
    | "fee_heads"
    | "fee_structures"
    | "students"
    | "teachers"
    | "opening_balance_details"
    | "student_academic_records"
    | "student_fee_schedule",
): Promise<number> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

export interface MigrationProgress {
  sessions: number;
  classes: number;
  sections: number;
  houses: number;
  feeHeads: number;
  feeStructures: number;
  students: number;
  academicRecords: number;
  feeSchedules: number;
  teachers: number;
  openingBalances: number;
}

export async function fetchMigrationProgress(): Promise<MigrationProgress> {
  const [
    sessions,
    classes,
    sections,
    houses,
    feeHeads,
    feeStructures,
    students,
    academicRecords,
    feeSchedules,
    teachers,
    openingBalances,
  ] = await Promise.all([
    countRows("academic_sessions"),
    countRows("school_classes"),
    countRows("school_sections"),
    countRows("houses"),
    countRows("fee_heads"),
    countRows("fee_structures"),
    countRows("students"),
    countRows("student_academic_records"),
    countRows("student_fee_schedule"),
    countRows("teachers"),
    countRows("opening_balance_details"),
  ]);
  return {
    sessions,
    classes,
    sections,
    houses,
    feeHeads,
    feeStructures,
    students,
    academicRecords,
    feeSchedules,
    teachers,
    openingBalances,
  };
}
