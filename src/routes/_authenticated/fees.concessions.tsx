import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/fees/concessions")({
  component: ConcessionsPage,
});

function ConcessionsPage() {
  const qc = useQueryClient();
  const { canApproveConcession, userId } = useUserRoles();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", academic_session_id: "", fee_head_id: "", concession_type: "Principal Approved", reason: "", amount: "" });

  const list = useQuery({
    queryKey: ["fee-concessions"],
    queryFn: async () => (await supabase.from("fee_concessions").select("*, students(full_name, scholar_number), academic_sessions(name), fee_heads(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const students = useQuery({ queryKey: ["students-min"], queryFn: async () => (await supabase.from("students").select("id, scholar_number, full_name").order("full_name").limit(500)).data ?? [] });
  const sessions = useQuery({ queryKey: ["sessions-min"], queryFn: async () => (await supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false })).data ?? [] });
  const heads = useQuery({ queryKey: ["heads-min"], queryFn: async () => (await supabase.from("fee_heads").select("id, name").eq("is_active", true).order("sort_order")).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.student_id || !form.academic_session_id || !form.amount) throw new Error("Fill all required fields");
      const { error } = await supabase.from("fee_concessions").insert({
        student_id: form.student_id, academic_session_id: form.academic_session_id,
        fee_head_id: form.fee_head_id || null, concession_type: form.concession_type,
        reason: form.reason || null, amount: Number(form.amount), approved_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Concession recorded"); setOpen(false); setForm({ student_id: "", academic_session_id: "", fee_head_id: "", concession_type: "Principal Approved", reason: "", amount: "" }); qc.invalidateQueries({ queryKey: ["fee-concessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Concessions" description="Approved fee concessions and audit trail." actions={canApproveConcession && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New Concession</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Concession</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Student *</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>{students.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.scholar_number} — {s.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Session *</Label>
                <Select value={form.academic_session_id} onValueChange={(v) => setForm({ ...form, academic_session_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                  <SelectContent>{sessions.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Type</Label>
                  <Select value={form.concession_type} onValueChange={(v) => setForm({ ...form, concession_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Staff Child">Staff Child</SelectItem>
                      <SelectItem value="Principal Approved">Principal Approved</SelectItem>
                      <SelectItem value="Sibling">Sibling</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Amount (₹) *</Label><Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Fee Head (optional scope)</Label>
                <Select value={form.fee_head_id} onValueChange={(v) => setForm({ ...form, fee_head_id: v })}>
                  <SelectTrigger><SelectValue placeholder="All heads" /></SelectTrigger>
                  <SelectContent>{heads.data?.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )} />
      <FeesTabs />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Fee Head</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.length ? list.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{new Date(c.approved_on ?? c.created_at).toLocaleDateString("en-IN")}</TableCell>
                <TableCell>{c.students?.full_name} <span className="text-xs text-muted-foreground">({c.students?.scholar_number})</span></TableCell>
                <TableCell>{c.academic_sessions?.name ?? "—"}</TableCell>
                <TableCell>{c.concession_type}</TableCell>
                <TableCell>{c.fee_heads?.name ?? "All"}</TableCell>
                <TableCell className="font-semibold">{c.amount != null ? formatINR(Number(c.amount)) : `${c.percentage}%`}</TableCell>
                <TableCell className="max-w-xs truncate">{c.reason ?? "—"}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No concessions yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
