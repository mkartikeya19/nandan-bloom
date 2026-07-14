import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Wallet, Loader2, RefreshCw, Ban } from "lucide-react";
import { allocatePayment, formatINR, generateStudentSchedule, nextReceiptNumber, outstandingOf, PAYMENT_MODES, PaymentMode, ScheduleRow } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/fees/collect/$studentId")({
  component: StudentFeePage,
});

function StudentFeePage() {
  const { studentId } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { canCollectFee, canVoidReceipt, userId } = useUserRoles();
  const [payOpen, setPayOpen] = useState(false);

  const student = useQuery({
    queryKey: ["student-fee-detail", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("students")
        .select("id, scholar_number, full_name, father_name, student_academic_records(id, academic_session_id, fee_structure_id, opening_balance, status, school_classes(name), school_sections(name), academic_sessions(id, name, start_date))")
        .eq("id", studentId).single();
      if (error) throw error;
      return data;
    },
  });

  const activeRecord = useMemo(() => {
    const recs = student.data?.student_academic_records ?? [];
    return recs.find((r) => r.status === "Active") ?? recs[0];
  }, [student.data]);

  const schedule = useQuery({
    queryKey: ["student-schedule", studentId, activeRecord?.id],
    enabled: !!activeRecord?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("student_fee_schedule")
        .select("id, fee_head_id, period_label, period_month, period_year, due_amount, concession_amount, paid_amount, status, is_opening_balance, display_order, sort_key, academic_session_id, fee_heads(name)")
        .eq("student_id", studentId)
        .order("is_opening_balance", { ascending: false })
        .order("display_order")
        .order("sort_key");
      if (error) throw error;
      return data;
    },
  });

  const payments = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_payments")
        .select("id, receipt_number, amount, payment_mode, payment_date, is_void, void_reason, transaction_reference")
        .eq("student_id", studentId).order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-generate schedule if none exists and structure linked
  const generate = useMutation({
    mutationFn: async () => {
      if (!activeRecord?.id) throw new Error("No active academic record");
      return await generateStudentSchedule(activeRecord.id);
    },
    onSuccess: (n) => { toast.success(`Generated ${n} fee items`); qc.invalidateQueries({ queryKey: ["student-schedule"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (schedule.data && schedule.data.length === 0 && activeRecord?.fee_structure_id && !generate.isPending) {
      generate.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.data, activeRecord?.fee_structure_id]);

  const rows: ScheduleRow[] = (schedule.data ?? []).map((r) => ({
    id: r.id, fee_head_id: r.fee_head_id, period_label: r.period_label,
    period_month: r.period_month, period_year: r.period_year,
    due_amount: Number(r.due_amount), concession_amount: Number(r.concession_amount),
    paid_amount: Number(r.paid_amount), status: r.status,
    is_opening_balance: r.is_opening_balance, display_order: r.display_order, sort_key: r.sort_key,
  }));

  const outstandingTotal = rows.reduce((s, r) => s + outstandingOf(r), 0);
  const openingOutstanding = rows.filter((r) => r.is_opening_balance).reduce((s, r) => s + outstandingOf(r), 0);

  const void_ = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("fee_payments").update({
        is_void: true, void_reason: reason, voided_by: userId, voided_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Receipt voided"); qc.invalidateQueries({ queryKey: ["student-payments"] }); qc.invalidateQueries({ queryKey: ["student-schedule"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={student.data?.full_name ?? "Student"}
        description={student.data ? `Scholar #${student.data.scholar_number} · ${activeRecord?.school_classes?.name ?? "—"} / ${activeRecord?.school_sections?.name ?? "—"} · ${activeRecord?.academic_sessions?.name ?? "—"}` : ""}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/fees/collect"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            <Button variant="outline" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending || !activeRecord?.fee_structure_id}>
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh Schedule
            </Button>
            {canCollectFee && <Button onClick={() => setPayOpen(true)} disabled={!activeRecord}><Wallet className="h-4 w-4" /> Collect Payment</Button>}
          </div>
        }
      />
      <FeesTabs />

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Father</p><p className="font-medium">{student.data?.father_name ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Previous Session Due</p><p className="text-lg font-semibold">{formatINR(openingOutstanding)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Outstanding</p><p className="text-lg font-semibold text-destructive">{formatINR(outstandingTotal)}</p></CardContent></Card>
      </div>

      {!activeRecord?.fee_structure_id && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm">This student's academic record has no fee structure linked. Ask an admin to set <code>fee_structure_id</code> on the record.</CardContent>
        </Card>
      )}

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Fee Schedule</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Head</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Concession</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No fee schedule yet.</TableCell></TableRow>
                ) : rows.map((r) => {
                  const head = schedule.data?.find((s) => s.id === r.id)?.fee_heads?.name ?? "—";
                  const os = outstandingOf(r);
                  return (
                    <TableRow key={r.id} className={r.is_opening_balance ? "bg-amber-500/5" : undefined}>
                      <TableCell>{r.is_opening_balance ? "Opening Balance" : head}</TableCell>
                      <TableCell>{r.period_label}</TableCell>
                      <TableCell>{formatINR(r.due_amount)}</TableCell>
                      <TableCell>{formatINR(r.concession_amount)}</TableCell>
                      <TableCell>{formatINR(r.paid_amount)}</TableCell>
                      <TableCell className={os > 0 ? "font-semibold text-destructive" : ""}>{formatINR(os)}</TableCell>
                      <TableCell><Badge variant={r.status === "Paid" ? "default" : r.status === "Partial" ? "secondary" : r.status === "Waived" ? "outline" : "destructive"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="ledger">
          <Card><CardContent className="p-0"><LedgerView rows={rows} payments={payments.data ?? []} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="history">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!payments.data?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payments yet.</TableCell></TableRow>
                ) : payments.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono"><Link to="/fees/receipts/$paymentId" params={{ paymentId: p.id }} className="text-primary hover:underline">{p.receipt_number}</Link></TableCell>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="font-semibold">{formatINR(Number(p.amount))}</TableCell>
                    <TableCell>{p.payment_mode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transaction_reference ?? "—"}</TableCell>
                    <TableCell>{p.is_void ? <Badge variant="destructive">Void</Badge> : <Badge>Paid</Badge>}</TableCell>
                    <TableCell>
                      {!p.is_void && canVoidReceipt && (
                        <VoidButton onVoid={(reason) => void_.mutate({ id: p.id, reason })} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {payOpen && activeRecord && (
        <CollectPaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          rows={rows}
          scheduleRaw={schedule.data ?? []}
          studentId={studentId}
          recordId={activeRecord.id}
          sessionId={activeRecord.academic_session_id}
          collectedBy={userId}
          onDone={(paymentId) => {
            setPayOpen(false);
            qc.invalidateQueries({ queryKey: ["student-schedule"] });
            qc.invalidateQueries({ queryKey: ["student-payments"] });
            nav({ to: "/fees/receipts/$paymentId", params: { paymentId } });
          }}
        />
      )}
    </div>
  );
}

function VoidButton({ onVoid }: { onVoid: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="ghost"><Ban className="h-4 w-4" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this receipt?</AlertDialogTitle>
          <AlertDialogDescription>The receipt stays in history but is marked void. Its allocations are reversed automatically.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment reversed by bank" /></div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!reason.trim()} onClick={() => onVoid(reason.trim())}>Void Receipt</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LedgerView({ rows, payments }: { rows: ScheduleRow[]; payments: Array<{ id: string; receipt_number: string; amount: number | string; payment_date: string; is_void: boolean }> }) {
  const entries: Array<{ date: string; ref: string; desc: string; debit: number; credit: number }> = [];
  for (const r of rows) {
    entries.push({ date: "", ref: "", desc: r.is_opening_balance ? "Opening Balance" : `${r.period_label}`, debit: Number(r.due_amount) - Number(r.concession_amount), credit: 0 });
  }
  for (const p of payments) {
    if (p.is_void) continue;
    entries.push({ date: p.payment_date, ref: p.receipt_number, desc: `Payment (${p.receipt_number})`, debit: 0, credit: Number(p.amount) });
  }
  entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let bal = 0;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Receipt #</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Debit</TableHead>
          <TableHead className="text-right">Credit</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, i) => {
          bal += e.debit - e.credit;
          return (
            <TableRow key={i}>
              <TableCell>{e.date ? new Date(e.date).toLocaleDateString("en-IN") : "—"}</TableCell>
              <TableCell className="font-mono">{e.ref || "—"}</TableCell>
              <TableCell>{e.desc}</TableCell>
              <TableCell className="text-right">{e.debit ? formatINR(e.debit) : "—"}</TableCell>
              <TableCell className="text-right">{e.credit ? formatINR(e.credit) : "—"}</TableCell>
              <TableCell className={"text-right font-medium " + (bal > 0 ? "text-destructive" : "")}>{formatINR(bal)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

interface CollectProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: ScheduleRow[];
  scheduleRaw: Array<{ id: string; fee_heads: { name: string } | null; period_label: string; is_opening_balance: boolean }>;
  studentId: string;
  recordId: string;
  sessionId: string;
  collectedBy: string | null;
  onDone: (paymentId: string) => void;
}

function CollectPaymentDialog({ open, onOpenChange, rows, scheduleRaw, studentId, recordId, sessionId, collectedBy, onDone }: CollectProps) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const autoAlloc = useMemo(() => allocatePayment(amount, rows), [amount, rows]);
  const effective: Array<{ scheduleId: string; amount: number }> = override
    ? Object.entries(overrides).map(([scheduleId, amt]) => ({ scheduleId, amount: Number(amt) || 0 })).filter((a) => a.amount > 0)
    : autoAlloc;
  const allocatedTotal = effective.reduce((s, a) => s + a.amount, 0);

  // Suggested collection: opening balance + Annual items + current-month recurring
  const suggested = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const picked = rows.filter((r) => {
      const os = outstandingOf(r);
      if (os <= 0) return false;
      if (r.is_opening_balance) return true;
      if (r.period_month == null) return true; // annual/one-time
      // include past-due months + current month
      if (r.period_year != null && (r.period_year < curYear || (r.period_year === curYear && r.period_month <= curMonth))) return true;
      return false;
    });
    return picked.reduce((s, r) => s + outstandingOf(r), 0);
  }, [rows]);


  const submit = async () => {
    if (submitting) return;
    if (amount <= 0) return toast.error("Enter an amount greater than 0");
    if (effective.length === 0) return toast.error("No allocations — cannot post a payment with nothing to allocate to");
    if (allocatedTotal - amount > 0.01) return toast.error("Allocated total exceeds amount");
    setSubmitting(true);
    try {
      const receipt = await nextReceiptNumber();
      const today = new Date().toISOString().slice(0, 10);
      const { data: payment, error: pErr } = await supabase.from("fee_payments").insert({
        student_id: studentId,
        academic_record_id: recordId,
        academic_session_id: sessionId,
        receipt_number: receipt,
        amount,
        sub_total: amount,
        payment_mode: mode,
        payment_date: today,
        academic_year: "",
        transaction_reference: reference || null,
        notes: notes || null,
        collected_by: collectedBy,
        status: "paid",
      }).select("id").single();
      if (pErr) throw pErr;
      const allocs = effective.map((a) => ({ fee_payment_id: payment.id, student_fee_schedule_id: a.scheduleId, amount: a.amount }));
      const { error: aErr } = await supabase.from("fee_payment_allocations").insert(allocs);
      if (aErr) throw aErr;
      await logActivity({
        module: "Fees",
        action: "Payment collected",
        entityType: "fee_payment",
        entityId: payment.id,
        details: { receipt, amount, mode, student_id: studentId },
      });
      toast.success(`Receipt ${receipt} generated`);
      onDone(payment.id);
    } catch (e) {
      console.error("Post payment failed", e);
      toast.error((e as Error).message || "Failed to post payment");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Amount (₹) *</Label><Input type="number" min={0} step="0.01" autoFocus value={amount || ""} onChange={(e) => setAmount(Number(e.target.value) || 0)} /></div>
            <div className="space-y-1.5"><Label>Payment Mode *</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {mode !== "Cash" && <div className="space-y-1.5"><Label>Transaction Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque #, UPI ref, etc." /></div>}
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          {suggested > 0 && (
            <div className="flex items-center justify-between rounded-md border bg-primary/5 p-3 text-sm">
              <div>
                <p className="font-medium">Suggested collection</p>
                <p className="text-xs text-muted-foreground">Opening balance + annual dues + current/past-due months</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{formatINR(suggested)}</span>
                <Button size="sm" variant="outline" onClick={() => setAmount(suggested)}>Use</Button>
              </div>
            </div>
          )}


          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Allocation ({formatINR(allocatedTotal)} / {formatINR(amount)})</Label>
              <Button size="sm" variant="ghost" onClick={() => { setOverride(!override); if (!override) { const o: Record<string, number> = {}; autoAlloc.forEach((a) => o[a.scheduleId] = a.amount); setOverrides(o); } }}>
                {override ? "Auto Allocate" : "Override"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="w-32 text-right">Allocate</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.filter((r) => outstandingOf(r) > 0).map((r) => {
                    const head = scheduleRaw.find((s) => s.id === r.id);
                    const autoAmt = autoAlloc.find((a) => a.scheduleId === r.id)?.amount ?? 0;
                    const val = override ? (overrides[r.id] ?? 0) : autoAmt;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.is_opening_balance ? "Opening Balance" : `${head?.fee_heads?.name ?? ""} · ${r.period_label}`}</TableCell>
                        <TableCell className="text-right">{formatINR(outstandingOf(r))}</TableCell>
                        <TableCell className="text-right">
                          {override ? (
                            <Input type="number" min={0} step="0.01" className="text-right h-8" value={overrides[r.id] ?? ""} onChange={(e) => setOverrides({ ...overrides, [r.id]: Number(e.target.value) || 0 })} />
                          ) : formatINR(val)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button disabled={submitting || amount <= 0 || Math.abs(allocatedTotal - amount) > 0.01}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />} Post Payment</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm payment of {formatINR(amount)}?</AlertDialogTitle>
                <AlertDialogDescription>A permanent receipt number will be generated. Receipts cannot be deleted, only voided.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={submit}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
