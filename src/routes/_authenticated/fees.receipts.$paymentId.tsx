import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer } from "lucide-react";
import { formatINR, amountInWords, outstandingOf } from "@/lib/fees-helpers";

export const Route = createFileRoute("/_authenticated/fees/receipts/$paymentId")({
  component: ReceiptView,
});

function ReceiptView() {
  const { paymentId } = Route.useParams();

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

  const outstandingAfter = useQuery({
    queryKey: ["outstanding-after", payment.data?.student_id],
    enabled: !!payment.data?.student_id,
    queryFn: async () => {
      const { data } = await supabase.from("student_fee_schedule")
        .select("due_amount, concession_amount, paid_amount")
        .eq("student_id", payment.data!.student_id);
      return (data ?? []).reduce((s, r) => s + outstandingOf(r as never), 0);
    },
  });

  const markPrinted = useMutation({
    mutationFn: async () => {
      const cur = payment.data!.receipt_print_count ?? 0;
      await supabase.from("fee_payments").update({ receipt_print_count: cur + 1, last_printed_at: new Date().toISOString() }).eq("id", paymentId);
    },
  });

  const doPrint = () => { markPrinted.mutate(); setTimeout(() => window.print(), 100); };

  if (payment.isLoading || !payment.data) return <div className="p-6">Loading…</div>;
  const p = payment.data;
  const active = p.students?.student_academic_records?.find((r) => r.status === "Active") ?? p.students?.student_academic_records?.[0];
  const allocations = p.fee_payment_allocations ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm"><Link to="/fees">Back</Link></Button>
        <Button onClick={doPrint}><Printer className="h-4 w-4" /> Print</Button>
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
            <div><span className="text-muted-foreground">Date:</span> {new Date(p.payment_date).toLocaleDateString("en-IN")}</div>
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
            <div><span className="text-muted-foreground">Outstanding After Payment:</span> <span className="font-semibold">{formatINR(outstandingAfter.data ?? 0)}</span></div>
            {p.is_void && <div className="col-span-2"><span className="text-muted-foreground">Void Reason:</span> {p.void_reason}</div>}
          </div>

          <div className="mt-16 flex justify-between text-sm">
            <div className="text-center"><div className="border-t border-black w-40 mb-1" /> Parent Signature</div>
            <div className="text-center"><div className="border-t border-black w-40 mb-1" /> Cashier Signature</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
