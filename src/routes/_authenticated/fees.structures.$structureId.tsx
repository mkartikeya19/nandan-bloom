import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, ArrowLeft, Save, Loader2, Lock, Eye } from "lucide-react";
import {
  MONTH_NAMES,
  formatINR,
  FEE_APPLICABILITY_LABELS,
  type FeeApplicability,
  type FeeFrequency,
} from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/fees/structures/$structureId")({
  component: FeeStructureBuilder,
});

interface HeadRow {
  id: string;
  name: string;
  is_mandatory: boolean;
  default_amount: number;
  default_frequency: FeeFrequency;
  default_applicable_months: number[] | null;
  auto_generate: boolean;
  charge_trigger: "Automatic" | "Manual";
  default_applicability: FeeApplicability;
  sort_order: number;
}

interface DraftRow {
  itemId?: string; // existing fee_structure_items.id (if any)
  fee_head_id: string;
  amount: number;
  head: HeadRow;
}

function FeeStructureBuilder() {
  const { structureId } = Route.useParams();
  const qc = useQueryClient();
  const { canManageFeeStructures } = useUserRoles();

  const structure = useQuery({
    queryKey: ["fee-structure", structureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_structures")
        .select("*, academic_sessions(name, start_date), school_classes(name)")
        .eq("id", structureId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const heads = useQuery({
    queryKey: ["fee-heads-active-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_heads")
        .select(
          "id, name, is_mandatory, default_amount, default_frequency, default_applicable_months, auto_generate, charge_trigger, default_applicability, sort_order",
        )
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as HeadRow[];
    },
  });

  const items = useQuery({
    queryKey: ["fee-structure-items", structureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_structure_items")
        .select("id, fee_head_id, amount")
        .eq("fee_structure_id", structureId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Count students already using this structure (lock indicator)
  const usage = useQuery({
    queryKey: ["fee-structure-usage", structureId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("student_academic_records")
        .select("id", { count: "exact", head: true })
        .eq("fee_structure_id", structureId);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const isLocked = (usage.data ?? 0) > 0;

  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (!heads.data || !items.data) return;
    const byHead = new Map(items.data.map((i) => [i.fee_head_id, i]));
    setDrafts(
      heads.data.map((h) => {
        const existing = byHead.get(h.id);
        return {
          itemId: existing?.id,
          fee_head_id: h.id,
          amount: existing ? Number(existing.amount) : 0,
          head: h,
        };
      }),
    );
  }, [heads.data, items.data]);

  const validation = useMemo(() => {
    const errors: Record<string, string> = {};
    for (const d of drafts) {
      if (d.amount < 0) errors[d.fee_head_id] = "Amount cannot be negative";
      else if (d.head.is_mandatory && d.amount <= 0)
        errors[d.fee_head_id] = "Mandatory — enter an amount";
    }
    return errors;
  }, [drafts]);
  const hasErrors = Object.keys(validation).length > 0;

  const configuredCount = drafts.filter((d) => d.amount > 0).length;
  const isComplete =
    configuredCount > 0 &&
    !hasErrors &&
    drafts.filter((d) => d.head.is_mandatory).every((d) => d.amount > 0);

  const total = drafts.reduce((s, d) => {
    if (d.amount <= 0) return s;
    const freq = d.head.default_frequency;
    if (freq === "Monthly" || freq === "Quarterly") {
      const months = (d.head.default_applicable_months ?? []).filter((m) => m !== 5 && m !== 6);
      return s + d.amount * months.length;
    }
    return s + d.amount;
  }, 0);

  const monthlyTuition =
    drafts.find(
      (d) =>
        d.head.default_frequency === "Monthly" &&
        /tuition|management|maintenance/i.test(d.head.name),
    )?.amount ?? 0;
  const admissionFee = drafts.find((d) => /admission/i.test(d.head.name))?.amount ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      if (hasErrors) throw new Error("Fix validation errors before saving");
      const existingIds = new Set(items.data?.map((i) => i.id) ?? []);
      const keptIds = new Set<string>();

      for (const d of drafts) {
        if (d.amount <= 0) continue;
        keptIds.add(d.itemId ?? "");
        const payload = {
          fee_structure_id: structureId,
          fee_head_id: d.fee_head_id,
          amount: d.amount,
          frequency: d.head.default_frequency,
          applicable_months:
            d.head.default_frequency === "Monthly" || d.head.default_frequency === "Quarterly"
              ? (d.head.default_applicable_months ?? []).filter((m) => m !== 5 && m !== 6)
              : null,
          is_optional: d.head.default_applicability === "Optional",
          applicability: d.head.default_applicability,
          sort_order: d.head.sort_order,
        };
        if (d.itemId) {
          const { error } = await supabase
            .from("fee_structure_items")
            .update(payload)
            .eq("id", d.itemId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("fee_structure_items").insert(payload);
          if (error) throw error;
        }
      }

      const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
      if (toDelete.length) {
        const { error } = await supabase.from("fee_structure_items").delete().in("id", toDelete);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Fee structure saved");
      qc.invalidateQueries({ queryKey: ["fee-structure-items", structureId] });
      qc.invalidateQueries({ queryKey: ["fee-structures-new"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStructure = useMutation({
    mutationFn: async () => {
      if (isLocked) throw new Error("Cannot delete: students are already using this structure");
      const { error } = await supabase.from("fee_structures").delete().eq("id", structureId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Structure deleted");
      window.location.href = "/fees/structures";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"new" | "existing">("new");
  const previewRows = useMemo(
    () =>
      buildPreview(drafts, structure.data?.academic_sessions?.start_date, previewMode === "new"),
    [drafts, structure.data, previewMode],
  );

  const canEdit = canManageFeeStructures;

  return (
    <div>
      <PageHeader
        title={structure.data?.name ?? "Fee Structure"}
        description={
          structure.data
            ? `${structure.data.academic_sessions?.name} · ${structure.data.school_classes?.name}`
            : ""
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/fees/structures">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> Generate Preview
            </Button>
            {canEdit && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isLocked}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this structure?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteStructure.mutate()}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {isLocked ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={save.isPending || hasErrors}>
                        {save.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}{" "}
                        Save
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Save changes to a locked structure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {usage.data} student record(s) are already using this structure. New
                          amounts will apply to future schedule generations. Historical schedules
                          and payments will not change.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => save.mutate()}>
                          Save anyway
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button onClick={() => save.mutate()} disabled={save.isPending || hasErrors}>
                    {save.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}{" "}
                    Save
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />
      <FeesTabs />

      {/* Summary card */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
        <SummaryCard label="Session" value={structure.data?.academic_sessions?.name ?? "—"} />
        <SummaryCard label="Class" value={structure.data?.school_classes?.name ?? "—"} />
        <SummaryCard label="Total Annual" value={formatINR(total)} highlight />
        <SummaryCard label="Monthly Tuition" value={formatINR(monthlyTuition)} />
        <SummaryCard label="Admission Fee" value={formatINR(admissionFee)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={isComplete ? "default" : "secondary"}>
          {isComplete ? "Complete" : "Draft"}
        </Badge>
        {isLocked && (
          <Badge variant="outline" className="gap-1">
            <Lock className="h-3 w-3" /> In use by {usage.data} student{usage.data === 1 ? "" : "s"}
          </Badge>
        )}
        {hasErrors && (
          <Badge variant="destructive">Fix {Object.keys(validation).length} error(s)</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fee Heads · rules inherited from master, only Amount is editable
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Head</TableHead>
                <TableHead className="w-36">Amount (₹)</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Months</TableHead>
                <TableHead>Applicability</TableHead>
                <TableHead>Auto Gen</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Mandatory</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No active fee heads. Create some in Settings → Fee Heads.
                  </TableCell>
                </TableRow>
              ) : (
                drafts.map((d, idx) => {
                  const err = validation[d.fee_head_id];
                  const freq = d.head.default_frequency;
                  const showMonths = freq === "Monthly" || freq === "Quarterly";
                  const months = (d.head.default_applicable_months ?? []).filter(
                    (m) => m !== 5 && m !== 6,
                  );
                  return (
                    <TableRow key={d.fee_head_id}>
                      <TableCell className="font-medium">
                        {d.head.name}
                        {d.head.is_mandatory && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Mandatory
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={d.amount || ""}
                          disabled={!canEdit}
                          aria-invalid={!!err}
                          className={err ? "border-destructive" : ""}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setDrafts((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, amount: v } : r)),
                            );
                          }}
                        />
                        {err && <p className="text-xs text-destructive mt-1">{err}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{freq}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                        {showMonths
                          ? months.length === 10
                            ? "Jul–Apr"
                            : months.map((m) => MONTH_NAMES[m - 1].slice(0, 3)).join(", ") || "—"
                          : "n/a"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {FEE_APPLICABILITY_LABELS[d.head.default_applicability]}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.head.auto_generate ? "default" : "secondary"}>
                          {d.head.auto_generate ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={d.head.charge_trigger === "Manual" ? "secondary" : "default"}
                        >
                          {d.head.charge_trigger}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.head.is_mandatory ? (
                          <Badge>Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fee Schedule Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-muted-foreground">Simulate as:</span>
            <Button
              size="sm"
              variant={previewMode === "new" ? "default" : "outline"}
              onClick={() => setPreviewMode("new")}
            >
              New Admission
            </Button>
            <Button
              size="sm"
              variant={previewMode === "existing" ? "default" : "outline"}
              onClick={() => setPreviewMode("existing")}
            >
              Existing / Promoted
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Read-only simulation — no records are created.
          </p>
          <div className="max-h-[420px] overflow-y-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Head</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                      Nothing would be generated for this mode.
                    </TableCell>
                  </TableRow>
                ) : (
                  previewRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.head}</TableCell>
                      <TableCell>{r.period}</TableCell>
                      <TableCell className="text-right">{formatINR(r.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="text-right text-sm font-semibold">
            Total: {formatINR(previewRows.reduce((s, r) => s + r.amount, 0))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={"font-semibold " + (highlight ? "text-lg text-primary" : "")}>{value}</p>
      </CardContent>
    </Card>
  );
}

// Client-side simulation of generate_student_fee_schedule for the Preview button.
function buildPreview(
  drafts: DraftRow[],
  sessionStartDate: string | undefined,
  isNewAdmission: boolean,
): Array<{ head: string; period: string; amount: number }> {
  if (!sessionStartDate) return [];
  const start = new Date(sessionStartDate);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1;
  const out: Array<{ head: string; period: string; amount: number }> = [];
  for (const d of drafts) {
    if (d.amount <= 0) continue;
    const h = d.head;
    if (!h.auto_generate || h.charge_trigger === "Manual") continue;
    const app = h.default_applicability;
    if (app === "Optional") continue;
    if (app === "NewAdmission" && !isNewAdmission) continue;
    if (app === "Existing" && isNewAdmission) continue;

    const freq = h.default_frequency;
    if (freq === "Monthly" || freq === "Quarterly") {
      const months = (h.default_applicable_months ?? []).filter((m) => m !== 5 && m !== 6);
      for (const m of months) {
        const yr = m >= startMonth ? startYear : startYear + 1;
        out.push({ head: h.name, period: `${MONTH_NAMES[m - 1]} ${yr}`, amount: d.amount });
      }
    } else if (freq === "Annual" || freq === "One Time") {
      out.push({ head: h.name, period: h.name, amount: d.amount });
    }
  }
  return out;
}
