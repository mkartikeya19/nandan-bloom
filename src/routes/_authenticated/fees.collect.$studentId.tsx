import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { allocatePayment, comparePriority, formatINR, generateStudentSchedule, nextReceiptNumber, outstandingOf, PAYMENT_MODES, PaymentMode, ScheduleRow } from "@/lib/fees-helpers";
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
        .select("id, fee_head_id, period_label, period_month, period_year, due_amount, concession_amount, paid_amount, status, is_opening_balance, display_order, sort_key, academic_session_id, fee_heads(name, sort_order, default_frequency)")
        .eq("student_id", studentId)
        .order("is_opening_balance", { ascending: false })
        .order("sort_key")
        .order("display_order");
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
    fee_head_name: r.fee_heads?.name,
    fee_head_sort_order: (r.fee_heads as { sort_order?: number } | null)?.sort_order,
    fee_head_frequency: (r.fee_heads as { default_frequency?: string } | null)?.default_frequency,
  })).sort(comparePriority);

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
            {canCollectFee && <Button onClick={() => setPayOpen(true)} disabled={!activeRecord || !activeRecord.fee_structure_id}><Wallet className="h-4 w-4" /> Collect Payment</Button>}
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
          <CardContent className="p-4 text-sm">This student's academic record has no Fee Structure linked. Admin/Super Admin can link it from the Student Profile Fees tab.</CardContent>
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

type CollectMode = "auto" | "manual" | "opening";

function CollectPaymentDialog({ open, onOpenChange, rows, scheduleRaw, studentId, recordId, sessionId, collectedBy, onDone }: CollectProps) {
  const settings = useQuery({
    queryKey: ["fee-settings-mode"],
    queryFn: async () => (await supabase.from("fee_settings").select("default_collection_mode").limit(1).maybeSingle()).data,
  });
  const defaultMode = (settings.data?.default_collection_mode ?? "auto") as CollectMode | "ask";

  const [mode, setModeState] = useState<CollectMode>(defaultMode === "ask" ? "auto" : (defaultMode as CollectMode));
  useEffect(() => {
    if (defaultMode !== "ask") setModeState(defaultMode as CollectMode);
  }, [defaultMode]);

  const [amount, setAmount] = useState(0);
  const [payMode, setPayMode] = useState<PaymentMode>("Cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const openingRows = useMemo(() => rows.filter((r) => r.is_opening_balance && outstandingOf(r) > 0), [rows]);

  const autoAlloc = useMemo(() => {
    if (mode === "opening") {
      let remaining = amount;
      const out: Array<{ scheduleId: string; amount: number }> = [];
      for (const r of openingRows) {
        if (remaining <= 0) break;
        const os = outstandingOf(r);
        const take = Math.min(os, remaining);
        out.push({ scheduleId: r.id, amount: take });
        remaining -= take;
      }
      return out;
    }
    return allocatePayment(amount, rows);
  }, [amount, rows, mode, openingRows]);

  const effective: Array<{ scheduleId: string; amount: number }> = mode === "manual"
    ? Object.entries(overrides).map(([scheduleId, amt]) => ({ scheduleId, amount: Number(amt) || 0 })).filter((a) => a.amount > 0)
    : autoAlloc;
  const allocatedTotal = effective.reduce((s, a) => s + a.amount, 0);

  // UAT-04: In Manual mode, partial payment against a single fee item is not
  // permitted. Each allocation must equal that row's outstanding amount (rounded).
  const partialErrors: string[] = [];
  if (mode === "manual") {
    for (const a of effective) {
      const row = rows.find((r) => r.id === a.scheduleId);
      if (!row) continue;
      const os = Math.round(outstandingOf(row) * 100) / 100;
      const alloc = Math.round(a.amount * 100) / 100;
      if (alloc > 0 && Math.abs(alloc - os) > 0.01) {
        const head = scheduleRaw.find((s) => s.id === a.scheduleId)?.fee_heads?.name ?? "Item";
        const label = row.is_opening_balance ? "Opening Balance" : `${head} · ${row.period_label}`;
        partialErrors.push(`${label}: must be ${formatINR(os)} (partial payment not permitted)`);
      }
    }
  }

  useEffect(() => {
    if (mode === "manual") {
      const o: Record<string, number> = {};
      autoAlloc.forEach((a) => (o[a.scheduleId] = a.amount));
      setOverrides(o);
    } else {
      setOverrides({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Suggested collection: opening balance + Annual items + current-month recurring
  const suggested = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const picked = rows.filter((r) => {
      const os = outstandingOf(r);
      if (os <= 0) return false;
      if (r.is_opening_balance) return true;
      if (r.period_month == null) return true;
      if (r.period_year != null && (r.period_year < curYear || (r.period_year === curYear && r.period_month <= curMonth))) return true;
      return false;
    });
    return picked.reduce((s, r) => s + outstandingOf(r), 0);
  }, [rows]);

  const openingTotal = openingRows.reduce((s, r) => s + outstandingOf(r), 0);

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
        payment_mode: payMode,
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
        details: { receipt, amount, mode: payMode, allocation_mode: mode, student_id: studentId },
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

  const setMode = (m: CollectMode) => { setModeState(m); setShowPreview(false); };




  // UAT-07: Group outstanding rows by fee head for readability. Groups keep
  // the priority order established by comparePriority (opening → one-time →
  // monthly chronological → optional).
  const visibleRows = (mode === "opening" ? openingRows : rows.filter((r) => outstandingOf(r) > 0));
  const groups: Array<{ key: string; label: string; rows: ScheduleRow[] }> = [];
  for (const r of visibleRows) {
    const key = r.is_opening_balance ? "__opening__" : r.fee_head_id;
    const label = r.is_opening_balance ? "Opening Balance (Previous Session)" : (r.fee_head_name ?? "Fee");
    const g = groups.find((x) => x.key === key);
    if (g) g.rows.push(r); else groups.push({ key, label, rows: [r] });
  }

  const canPreview = amount > 0 && effective.length > 0 && partialErrors.length === 0 && (allocatedTotal - amount <= 0.01);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex max-h-[90vh] flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b p-4">
          <DialogTitle>Collect Payment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 overflow-y-auto p-4">
          {/* Mode selector */}
          <div>
            <Label className="mb-1.5 block">Allocation Mode</Label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={mode === "auto" ? "default" : "outline"} onClick={() => setMode("auto")}>Quick Collect</Button>
              <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Manual Allocation</Button>
              <Button size="sm" variant={mode === "opening" ? "default" : "outline"} disabled={openingTotal <= 0} onClick={() => setMode("opening")}>
                Opening Balance Only {openingTotal > 0 && <span className="ml-1 text-xs">({formatINR(openingTotal)})</span>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mode === "auto" && "Amount auto-allocated by business priority: opening balance → one-time dues → monthly (chronological) → optional."}
              {mode === "manual" && "Choose exactly how the amount is split. Partial payment against a single item is not permitted — allocate the full outstanding or leave it blank."}
              {mode === "opening" && "Applies only to previous-session opening balance rows."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Amount (₹) *</Label><Input type="number" min={0} step="0.01" autoFocus value={amount || ""} onChange={(e) => { setAmount(Number(e.target.value) || 0); setShowPreview(false); }} /></div>
            <div className="space-y-1.5"><Label>Payment Mode *</Label>
              <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {payMode !== "Cash" && <div className="space-y-1.5"><Label>Transaction Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque #, UPI ref, etc." /></div>}
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>

          {mode === "auto" && suggested > 0 && (
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
            </div>
            <div className="rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="w-32 text-right">Allocate</TableHead></TableRow></TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <Fragment key={g.key}>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableCell colSpan={3} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</TableCell>
                      </TableRow>
                      {g.rows.map((r) => {
                        const autoAmt = autoAlloc.find((a) => a.scheduleId === r.id)?.amount ?? 0;
                        const val = mode === "manual" ? (overrides[r.id] ?? 0) : autoAmt;
                        const os = outstandingOf(r);
                        const invalid = mode === "manual" && val > 0 && Math.abs(val - os) > 0.01;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="pl-6">{r.is_opening_balance ? "—" : r.period_label}</TableCell>
                            <TableCell className="text-right">{formatINR(os)}</TableCell>
                            <TableCell className="text-right">
                              {mode === "manual" ? (
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className={"text-right h-8 " + (invalid ? "border-destructive" : "")}
                                  value={overrides[r.id] ?? ""}
                                  onChange={(e) => { setOverrides({ ...overrides, [r.id]: Number(e.target.value) || 0 }); setShowPreview(false); }}
                                />
                              ) : formatINR(val)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {mode === "manual" && partialErrors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <p className="font-medium text-destructive mb-1">Partial payment is not permitted for these items:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-destructive/90">
                {partialErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {showPreview && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <p className="text-sm font-semibold">Confirm allocation</p>
              <div className="text-xs space-y-1">
                {effective.map((a) => {
                  const row = rows.find((r) => r.id === a.scheduleId);
                  const head = scheduleRaw.find((s) => s.id === a.scheduleId);
                  const label = row?.is_opening_balance ? "Opening Balance" : `${head?.fee_heads?.name ?? ""} · ${row?.period_label ?? ""}`;
                  return <div key={a.scheduleId} className="flex justify-between"><span>{label}</span><span className="font-mono">{formatINR(a.amount)}</span></div>;
                })}
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-1"><span>Total</span><span>{formatINR(allocatedTotal)}</span></div>
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-background p-4">
          <div className="mr-auto text-xs text-muted-foreground">
            Allocated <span className="font-semibold text-foreground">{formatINR(allocatedTotal)}</span> of <span className="font-semibold text-foreground">{formatINR(amount)}</span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          {!showPreview ? (
            <Button onClick={() => setShowPreview(true)} disabled={!canPreview}>Preview</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)} disabled={submitting}>Modify</Button>
              <Button onClick={submit} disabled={submitting || !canPreview}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm & Post
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


