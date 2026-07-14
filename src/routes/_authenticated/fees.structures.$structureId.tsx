import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Save, Loader2 } from "lucide-react";
import { FEE_FREQUENCIES, FeeFrequency, FEE_APPLICABILITIES, FEE_APPLICABILITY_LABELS, FeeApplicability, MONTH_NAMES, formatINR } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/fees/structures/$structureId")({
  component: FeeStructureBuilder,
});

interface DraftItem {
  id?: string;
  fee_head_id: string;
  amount: number;
  frequency: FeeFrequency;
  applicable_months: number[];
  is_optional: boolean;
  applicability: FeeApplicability;
  sort_order: number;
}

function FeeStructureBuilder() {
  const { structureId } = Route.useParams();
  const qc = useQueryClient();
  const { canManageFeeStructures } = useUserRoles();

  const structure = useQuery({
    queryKey: ["fee-structure", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_structures")
        .select("*, academic_sessions(name), school_classes(name)")
        .eq("id", structureId).single();
      if (error) throw error;
      return data;
    },
  });

  const heads = useQuery({
    queryKey: ["fee-heads-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_heads")
        .select("id, name, code, default_frequency, default_applicable_months, sort_order")
        .eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    queryKey: ["fee-structure-items", structureId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_structure_items")
        .select("*, fee_heads(name, code)")
        .eq("fee_structure_id", structureId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  useEffect(() => {
    if (items.data) {
      setDrafts(items.data.map((i, idx) => ({
        id: i.id,
        fee_head_id: i.fee_head_id,
        amount: Number(i.amount),
        frequency: i.frequency as FeeFrequency,
        applicable_months: i.applicable_months ?? [],
        is_optional: i.is_optional,
        sort_order: i.sort_order || (idx + 1) * 10,
      })));
    }
  }, [items.data]);

  const addHead = (headId: string) => {
    const h = heads.data?.find((x) => x.id === headId);
    if (!h) return;
    if (drafts.some((d) => d.fee_head_id === headId)) {
      toast.error("This fee head is already added");
      return;
    }
    setDrafts([...drafts, {
      fee_head_id: headId,
      amount: 0,
      frequency: h.default_frequency as FeeFrequency,
      applicable_months: h.default_applicable_months ?? [],
      is_optional: false,
      sort_order: h.sort_order ?? drafts.length * 10 + 10,
    }]);
  };

  const updateDraft = (idx: number, patch: Partial<DraftItem>) => {
    setDrafts(drafts.map((d, i) => i === idx ? { ...d, ...patch } : d));
  };
  const removeDraft = (idx: number) => setDrafts(drafts.filter((_, i) => i !== idx));

  const save = useMutation({
    mutationFn: async () => {
      // Upsert all drafts; delete removed items
      const existingIds = new Set(items.data?.map((i) => i.id) ?? []);
      const keptIds = new Set(drafts.filter((d) => d.id).map((d) => d.id!));
      const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
      if (toDelete.length) {
        const { error } = await supabase.from("fee_structure_items").delete().in("id", toDelete);
        if (error) throw error;
      }
      for (const d of drafts) {
        const payload = {
          fee_structure_id: structureId,
          fee_head_id: d.fee_head_id,
          amount: d.amount,
          frequency: d.frequency,
          applicable_months: d.frequency === "Monthly" || d.frequency === "Quarterly" ? d.applicable_months : null,
          is_optional: d.is_optional,
          sort_order: d.sort_order,
        };
        if (d.id) {
          const { error } = await supabase.from("fee_structure_items").update(payload).eq("id", d.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("fee_structure_items").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Fee structure saved");
      qc.invalidateQueries({ queryKey: ["fee-structure-items", structureId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStructure = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fee_structures").delete().eq("id", structureId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Structure deleted"); window.location.href = "/fees/structures"; },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = drafts.reduce((s, d) => {
    if (d.frequency === "Monthly" || d.frequency === "Quarterly") return s + d.amount * (d.applicable_months?.length ?? 0);
    return s + d.amount;
  }, 0);

  return (
    <div>
      <PageHeader
        title={structure.data?.name ?? "Fee Structure"}
        description={structure.data ? `${structure.data.academic_sessions?.name} · ${structure.data.school_classes?.name}` : ""}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/fees/structures"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            {canManageFeeStructures && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this structure?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone. Students already linked will lose their fee schedule reference.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteStructure.mutate()}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>
              </>
            )}
          </div>
        }
      />
      <FeesTabs />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Fee Heads · Annual Total {formatINR(total)}</CardTitle>
          {canManageFeeStructures && (
            <Select value="" onValueChange={addHead}>
              <SelectTrigger className="w-56"><SelectValue placeholder="+ Add Fee Head" /></SelectTrigger>
              <SelectContent>
                {heads.data?.filter((h) => !drafts.some((d) => d.fee_head_id === h.id)).map((h) => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Head</TableHead>
                <TableHead className="w-32">Amount (₹)</TableHead>
                <TableHead className="w-36">Frequency</TableHead>
                <TableHead>Applicable Months</TableHead>
                <TableHead className="w-20">Optional</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No fee heads added yet.</TableCell></TableRow>
              ) : drafts.map((d, idx) => {
                const head = heads.data?.find((h) => h.id === d.fee_head_id);
                const showMonths = d.frequency === "Monthly" || d.frequency === "Quarterly";
                return (
                  <TableRow key={d.id ?? idx}>
                    <TableCell className="font-medium">{head?.name ?? "—"}</TableCell>
                    <TableCell><Input type="number" min={0} step="0.01" value={d.amount} disabled={!canManageFeeStructures} onChange={(e) => updateDraft(idx, { amount: Number(e.target.value) || 0 })} /></TableCell>
                    <TableCell>
                      <Select value={d.frequency} disabled={!canManageFeeStructures} onValueChange={(v) => updateDraft(idx, { frequency: v as FeeFrequency })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FEE_FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {showMonths ? (
                        <div className="flex flex-wrap gap-1">
                          {MONTH_NAMES.map((m, i) => {
                            const mn = i + 1;
                            const on = d.applicable_months.includes(mn);
                            return (
                              <Button
                                key={mn}
                                type="button"
                                size="sm"
                                variant={on ? "default" : "outline"}
                                className="h-6 px-2 text-xs"
                                disabled={!canManageFeeStructures}
                                onClick={() => updateDraft(idx, {
                                  applicable_months: on ? d.applicable_months.filter((x) => x !== mn) : [...d.applicable_months, mn].sort((a, b) => a - b),
                                })}
                              >{m.slice(0, 3)}</Button>
                            );
                          })}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">n/a</span>}
                    </TableCell>
                    <TableCell><Checkbox checked={d.is_optional} disabled={!canManageFeeStructures} onCheckedChange={(v) => updateDraft(idx, { is_optional: !!v })} /></TableCell>
                    <TableCell>{canManageFeeStructures && <Button size="icon" variant="ghost" onClick={() => removeDraft(idx)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
