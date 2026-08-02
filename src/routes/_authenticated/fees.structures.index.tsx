import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/fees/structures/")({
  component: FeeStructuresList,
});

interface StructureRow {
  id: string;
  name: string;
  is_active: boolean;
  academic_session_id: string;
  class_id: string;
  academic_sessions: { name: string } | null;
  school_classes: { name: string } | null;
}

function FeeStructuresList() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { canManageFeeStructures } = useUserRoles();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", academic_session_id: "", class_id: "" });

  const sessions = useQuery({
    queryKey: ["academic-sessions"],
    queryFn: async () =>
      (
        await supabase
          .from("academic_sessions")
          .select("id, name, start_date, end_date")
          .order("start_date", { ascending: false })
      ).data ?? [],
  });
  const classes = useQuery({
    queryKey: ["school-classes"],
    queryFn: async () =>
      (await supabase.from("school_classes").select("id, name").order("name")).data ?? [],
  });

  const structures = useQuery({
    queryKey: ["fee-structures-new"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_structures")
        .select(
          "id, name, is_active, academic_session_id, class_id, academic_sessions(name), school_classes(name)",
        )
        .not("academic_session_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StructureRow[];
    },
  });

  // Fetch item summary (head_id + amount + mandatory) to compute Draft/Complete
  const itemsSummary = useQuery({
    queryKey: ["fee-structures-items-summary"],
    queryFn: async () => {
      const [{ data: items }, { data: heads }] = await Promise.all([
        supabase.from("fee_structure_items").select("fee_structure_id, fee_head_id, amount"),
        supabase.from("fee_heads").select("id, is_mandatory, is_active"),
      ]);
      return {
        items: items ?? [],
        heads: heads ?? [],
      };
    },
  });

  const statusFor = (structureId: string): "Draft" | "Complete" => {
    if (!itemsSummary.data) return "Draft";
    const items = itemsSummary.data.items.filter(
      (i) => i.fee_structure_id === structureId && Number(i.amount) > 0,
    );
    if (items.length === 0) return "Draft";
    const mandatoryHeads = itemsSummary.data.heads.filter((h) => h.is_active && h.is_mandatory);
    const configuredHeadIds = new Set(items.map((i) => i.fee_head_id));
    const allMandatoryConfigured = mandatoryHeads.every((h) => configuredHeadIds.has(h.id));
    return allMandatoryConfigured ? "Complete" : "Draft";
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.academic_session_id || !form.class_id)
        throw new Error("All fields required");
      const { data, error } = await supabase
        .from("fee_structures")
        .insert({
          name: form.name.trim(),
          academic_session_id: form.academic_session_id,
          class_id: form.class_id,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Structure created — configure amounts");
      setOpen(false);
      setForm({ name: "", academic_session_id: "", class_id: "" });
      qc.invalidateQueries({ queryKey: ["fee-structures-new"] });
      nav({ to: "/fees/structures/$structureId", params: { structureId: id } });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate")
          ? "A structure for this session+class already exists"
          : e.message,
      ),
  });

  return (
    <div>
      <PageHeader
        title="Fee Structures"
        description="Session-wise fee structures per class. A structure must have amounts configured before it can be used."
        actions={
          canManageFeeStructures && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> New Structure
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Fee Structure</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Class 1 - 2025-26"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Academic Session</Label>
                    <Select
                      value={form.academic_session_id}
                      onValueChange={(v) => setForm({ ...form, academic_session_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.data?.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Class</Label>
                    <Select
                      value={form.class_id}
                      onValueChange={(v) => setForm({ ...form, class_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.data?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You'll be taken to the editor to set fee amounts.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create &
                    Configure
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <FeesTabs />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structures.data?.length ? (
                structures.data.map((s) => {
                  const status = statusFor(s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">
                        <Link
                          to="/fees/structures/$structureId"
                          params={{ structureId: s.id }}
                          className="hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>{s.academic_sessions?.name ?? "—"}</TableCell>
                      <TableCell>{s.school_classes?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={status === "Complete" ? "default" : "secondary"}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/fees/structures/$structureId" params={{ structureId: s.id }}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No structures yet. Click "New Structure" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
