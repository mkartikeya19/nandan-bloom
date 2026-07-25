import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Printer, Ban, Download } from "lucide-react";
import { toast } from "sonner";
import { formatINR, amountInWords, outstandingOf } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";
import { logActivity } from "@/lib/activity";
import { formatActivityDetails } from "@/lib/activity-format";

export const Route = createFileRoute("/_authenticated/fees/receipts/$paymentId")({
  component: ReceiptView,
});

function ReceiptView() {
  const { paymentId } = Route.useParams();
  const qc = useQueryClient();
  const { canVoidReceipt, userId } = useUserRoles();

  const payment = useQuery({
    queryKey: ["receipt", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_payments")
        .select("*, students(scholar_number, full_name, father_name, student_academic_records(school_classes(name), school_sections(name), academic_sessions(name), status)), fee_payment_allocations(id, amount, student_fee_schedule(period_label, is_opening_balance, fee_heads(name)))")
        .eq("id", paymentId).single();
      if (error) throw error;
      return data;
    },
  });

  const school = useQuery({
    queryKey: ["school-profile-header"],
    queryFn: async () => (await supabase.from("school_profile").select("*").limit(1).maybeSingle()).data,
  });

  const collectorIds = useMemo(() => {
    const ids = new Set<string>();
    if (payment.data?.collected_by) ids.add(payment.data.collected_by);
    if (payment.data?.voided_by) ids.add(payment.data.voided_by);
    return Array.from(ids);
  }, [payment.data?.collected_by, payment.data?.voided_by]);

  const staff = useQuery({
    queryKey: ["receipt-staff", collectorIds],
    enabled: collectorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", collectorIds);
      return data ?? [];
    },
  });
  const nameOf = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = staff.data?.find((x) => x.id === id);
    return p?.full_name || p?.email || id;
  };

  const timeline = useQuery({
    queryKey: ["receipt-activity", paymentId],
    queryFn: async () => {
      const { data } = await supabase.from("activity_log")
        .select("id, action, module, details, created_at, user_id")
        .eq("entity_type", "fee_payment").eq("entity_id", paymentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const outstandingAfter = useQuery({
    queryKey: ["outstanding-after", payment.data?.student_id, payment.data?.is_void],
    enabled: !!payment.data?.student_id,
    queryFn: async () => {
      const { data } = await supabase.from("student_fee_schedule")
        .select("due_amount, concession_amount, paid_amount")
        .eq("student_id", payment.data!.student_id);
      return (data ?? []).reduce((s, r) => s + outstandingOf(r as never), 0);
    },
  });

  // Log first view as "downloaded" only when triggered explicitly.
  const [firstPrintLogged, setFirstPrintLogged] = useState(false);
  useEffect(() => { setFirstPrintLogged(false); }, [paymentId]);

  const markPrinted = useMutation({
    mutationFn: async (kind: "print" | "download") => {
      const cur = payment.data?.receipt_print_count ?? 0;
      await supabase.from("fee_payments").update({
        receipt_print_count: cur + 1,
        last_printed_at: new Date().toISOString(),
      }).eq("id", paymentId);
      const action = kind === "download"
        ? "Receipt downloaded"
        : cur === 0 && !firstPrintLogged ? "Receipt printed" : "Receipt reprinted";
      await logActivity({
        module: "Fees",
        action,
        entityType: "fee_payment",
        entityId: paymentId,
        details: {
          receipt_number: payment.data?.receipt_number,
          student_id: payment.data?.student_id,
          print_count: cur + 1,
        },
      });
      setFirstPrintLogged(true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receipt", paymentId] });
      qc.invalidateQueries({ queryKey: ["receipt-activity", paymentId] });
    },
  });

  const doPrint = () => { markPrinted.mutate("print"); setTimeout(() => window.print(), 120); };
  const doDownload = () => { markPrinted.mutate("download"); setTimeout(() => window.print(), 120); };

  const voidReceipt = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase.from("fee_payments").update({
        is_void: true,
        void_reason: reason,
        voided_by: userId,
        voided_at: new Date().toISOString(),
      }).eq("id", paymentId);
      if (error) throw error;
      await logActivity({
        module: "Fees",
        action: "Receipt voided",
        entityType: "fee_payment",
        entityId: paymentId,
        details: {
          receipt_number: payment.data?.receipt_number,
          student_id: payment.data?.student_id,
          amount: payment.data?.amount,
          void_reason: reason,
        },
      });
    },
    onSuccess: () => {
      toast.success("Receipt voided. Ledger restored.");
      qc.invalidateQueries({ queryKey: ["receipt", paymentId] });
      qc.invalidateQueries({ queryKey: ["receipt-activity", paymentId] });
      qc.invalidateQueries({ queryKey: ["student-schedule"] });
      qc.invalidateQueries({ queryKey: ["student-payments"] });
      qc.invalidateQueries({ queryKey: ["outstanding-after"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (payment.isLoading || !payment.data) return <div className="p-6">Loading…</div>;
  const p = payment.data;
  const active = p.students?.student_academic_records?.find((r) => r.status === "Active") ?? p.students?.student_academic_records?.[0];
  const allocations = p.fee_payment_allocations ?? [];
  const concession = allocations.reduce((s, a) => {
    // Concession is stored on schedule rows — surface a synthesized "note" only
    return s;
  }, 0);
  void concession;

  const paidAt = p.payment_date ? new Date(p.payment_date) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/fees/collect/$studentId" params={{ studentId: p.student_id }}>
            <ArrowLeft className="h-4 w-4" /> Back to Student
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doDownload}><Download className="h-4 w-4" /> Download PDF</Button>
          <Button onClick={doPrint}><Printer className="h-4 w-4" /> Print</Button>
          {!p.is_void && canVoidReceipt && (
            <VoidReceiptButton onConfirm={(reason) => voidReceipt.mutate(reason)} pending={voidReceipt.isPending} />
          )}
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 print:p-4">
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">{school.data?.name ?? "Nandan Kids Higher Secondary School"}</h1>
            {school.data?.address && <p className="text-sm text-muted-foreground">{school.data.address}</p>}
            <p className="mt-2 font-semibold uppercase tracking-wide">Fee Receipt</p>
            {p.is_void && <p className="text-destructive font-bold text-lg">** VOID **</p>}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
            <div><span className="text-muted-foreground">Receipt No:</span> <span className="font-mono font-semibold">{p.receipt_number}</span></div>
            <div><span className="text-muted-foreground">Date &amp; Time:</span> {paidAt ? paidAt.toLocaleString("en-IN") : "—"}</div>
            <div><span className="text-muted-foreground">Scholar No:</span> {p.students?.scholar_number}</div>
            <div><span className="text-muted-foreground">Session:</span> {active?.academic_sessions?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{p.students?.full_name}</span></div>
            <div><span className="text-muted-foreground">Father:</span> {p.students?.father_name ?? "—"}</div>
            <div><span className="text-muted-foreground">Class:</span> {active?.school_classes?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Section:</span> {active?.school_sections?.name ?? "—"}</div>
          </div>

          <table className="w-full text-sm border mb-4">
            <thead className="bg-muted"><tr><th className="text-left p-2">Fee Head</th><th className="text-left p-2">Period</th><th className="text-right p-2">Amount (₹)</th></tr></thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.student_fee_schedule?.is_opening_balance ? "Opening Balance" : a.student_fee_schedule?.fee_heads?.name ?? "—"}</td>
                  <td className="p-2">{a.student_fee_schedule?.period_label ?? "—"}</td>
                  <td className="p-2 text-right">{formatINR(Number(a.amount))}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted font-semibold"><td colSpan={2} className="p-2 text-right">Total Paid</td><td className="p-2 text-right">{formatINR(Number(p.amount))}</td></tr>
            </tbody>
          </table>

          <p className="text-sm mb-4"><span className="text-muted-foreground">Amount in Words:</span> <span className="italic">{amountInWords(Number(p.amount))}</span></p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Payment Mode:</span> {p.payment_mode}</div>
            <div><span className="text-muted-foreground">Reference:</span> {p.transaction_reference ?? "—"}</div>
            <div><span className="text-muted-foreground">Collected By:</span> {nameOf(p.collected_by)}</div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              {p.is_void ? <Badge variant="destructive">Void</Badge> : <Badge>Active</Badge>}
            </div>
            {p.notes && <div className="col-span-2"><span className="text-muted-foreground">Remarks:</span> {p.notes}</div>}
            <div><span className="text-muted-foreground">Outstanding After Payment:</span> <span className="font-semibold">{formatINR(outstandingAfter.data ?? 0)}</span></div>
            <div><span className="text-muted-foreground">Print Count:</span> {p.receipt_print_count ?? 0}</div>
            {p.is_void && (
              <>
                <div className="col-span-2"><span className="text-muted-foreground">Void Reason:</span> {p.void_reason}</div>
                <div><span className="text-muted-foreground">Voided By:</span> {nameOf(p.voided_by)}</div>
                <div><span className="text-muted-foreground">Voided At:</span> {p.voided_at ? new Date(p.voided_at).toLocaleString("en-IN") : "—"}</div>
              </>
            )}
          </div>

          <div className="mt-16 flex justify-between text-sm">
            <div className="text-center"><div className="border-t border-black w-40 mb-1" /> Parent Signature</div>
            <div className="text-center"><div className="border-t border-black w-40 mb-1" /> Cashier Signature</div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 print:hidden">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">Activity Timeline</p>
          {!timeline.data?.length ? (
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {timeline.data.map((row) => (
                <li key={row.id} className="flex flex-col gap-0.5 border-l-2 border-primary/40 pl-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{row.action}</span>
                    <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-IN")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {nameOf(row.user_id)} — {formatActivityDetails(row.module ?? "Fees", row.action, (row.details as Record<string, unknown>) ?? null)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VoidReceiptButton({ onConfirm, pending }: { onConfirm: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive"><Ban className="h-4 w-4" /> Void Receipt</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this receipt?</AlertDialogTitle>
          <AlertDialogDescription>
            The receipt number is preserved and marked VOID. All allocations are reversed,
            the student ledger is restored, and this action is recorded in the Activity Log.
            To correct a mistake, void this receipt and post a new one.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label>Reason <span className="text-destructive">*</span></Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong amount entered, cheque bounced, duplicate receipt" rows={3} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>
            Void Receipt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
