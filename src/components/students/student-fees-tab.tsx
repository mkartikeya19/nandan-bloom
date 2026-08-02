import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, LinkIcon, Wallet } from "lucide-react";
import { formatINR, outstandingOf, ScheduleRow } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";
import { toast } from "sonner";

interface Props {
  studentId: string;
  activeRecordId: string | null;
  hasFeeStructure?: boolean;
}

export function StudentFeesTab({ studentId, activeRecordId, hasFeeStructure = true }: Props) {
  const qc = useQueryClient();
  const { canCollectFee, isAdmin, isSuperAdmin } = useUserRoles();
  const canRepairFeeStructure = !!activeRecordId && !hasFeeStructure && (isAdmin || isSuperAdmin);

  const schedule = useQuery({
    queryKey: ["student-schedule", studentId, activeRecordId],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_fee_schedule")
        .select("id, fee_head_id, period_label, period_month, period_year, due_amount, concession_amount, paid_amount, status, is_opening_balance, display_order, sort_key, fee_heads(name)")
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
        .select("id, receipt_number, amount, payment_mode, payment_date, is_void, transaction_reference")
        .eq("student_id", studentId).order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows: ScheduleRow[] = (schedule.data ?? []).map((r) => ({
    id: r.id, fee_head_id: r.fee_head_id, period_label: r.period_label,
    period_month: r.period_month, period_year: r.period_year,
    due_amount: Number(r.due_amount), concession_amount: Number(r.concession_amount),
    paid_amount: Number(r.paid_amount), status: r.status,
    is_opening_balance: r.is_opening_balance, display_order: r.display_order, sort_key: r.sort_key,
  }));

  const totalDue = rows.reduce((s, r) => s + Number(r.due_amount) - Number(r.concession_amount), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paid_amount), 0);
  const outstanding = rows.reduce((s, r) => s + outstandingOf(r), 0);
  const opening = rows.filter((r) => r.is_opening_balance).reduce((s, r) => s + outstandingOf(r), 0);

  const linkFeeStructure = useMutation({
    mutationFn: async () => {
      if (!activeRecordId) throw new Error("No active academic record found");
      const { data, error } = await (supabase as any).rpc("link_academic_record_fee_structure", { _record_id: activeRecordId });
      if (error) throw error;
      return Number(data?.generated_count ?? 0);
    },
    onSuccess: (count) => {
      toast.success(`Fee Structure linked. ${count} schedule row${count === 1 ? "" : "s"} generated.`);
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      qc.invalidateQueries({ queryKey: ["student-schedule", studentId, activeRecordId] });
      qc.invalidateQueries({ queryKey: ["student-payments", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat
          label="Opening Balance"
          value={formatINR(opening)}
          action={
            <button type="button" className="mt-1 text-xs text-primary hover:underline" onClick={() => setBreakupOpen(true)}>
              View Breakup
            </button>
          }
        />
        <Stat label="Total Due" value={formatINR(totalDue)} />
        <Stat label="Total Paid" value={formatINR(totalPaid)} />
        <Stat label="Outstanding" value={formatINR(outstanding)} tone={outstanding > 0 ? "danger" : "default"} />
      </div>

      <OpeningBalanceBreakupDialog studentId={studentId} open={breakupOpen} onOpenChange={setBreakupOpen} />


      {!hasFeeStructure && activeRecordId && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">This active academic record has no Fee Structure linked.</p>
            {canRepairFeeStructure && (
              <Button size="sm" onClick={() => linkFeeStructure.mutate()} disabled={linkFeeStructure.isPending}>
                {linkFeeStructure.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                Link Fee Structure
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {canCollectFee && hasFeeStructure && (
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link to="/fees/collect/$studentId" params={{ studentId }}>
              <Wallet className="h-4 w-4" /> Collect Fee
            </Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Fee Schedule</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fee Head</TableHead><TableHead>Period</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Concession</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No fee schedule yet. {activeRecordId ? "Open Fee Collection to generate one." : "No active academic record."}
                  </TableCell></TableRow>
                ) : rows.map((r) => {
                  const head = schedule.data?.find((s) => s.id === r.id)?.fee_heads?.name ?? "—";
                  const os = outstandingOf(r);
                  return (
                    <TableRow key={r.id} className={r.is_opening_balance ? "bg-amber-500/5" : undefined}>
                      <TableCell>{r.is_opening_balance ? "Opening Balance" : head}</TableCell>
                      <TableCell>{r.period_label}</TableCell>
                      <TableCell className="text-right">{formatINR(r.due_amount)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.concession_amount)}</TableCell>
                      <TableCell className="text-right">{formatINR(r.paid_amount)}</TableCell>
                      <TableCell className={"text-right " + (os > 0 ? "font-semibold text-destructive" : "")}>{formatINR(os)}</TableCell>
                      <TableCell><Badge variant={r.status === "Paid" ? "default" : r.status === "Partial" ? "secondary" : r.status === "Waived" ? "outline" : "destructive"}>{r.status}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card><CardContent className="p-0">
            <LedgerView rows={rows} payments={payments.data ?? []} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Receipt #</TableHead><TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!payments.data?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No payments yet.</TableCell></TableRow>
                ) : payments.data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">
                      <Link to="/fees/receipts/$paymentId" params={{ paymentId: p.id }} className="text-primary hover:underline">{p.receipt_number}</Link>
                    </TableCell>
                    <TableCell>{new Date(p.payment_date).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(Number(p.amount))}</TableCell>
                    <TableCell>{p.payment_mode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transaction_reference ?? "—"}</TableCell>
                    <TableCell>{p.is_void ? <Badge variant="destructive">Void</Badge> : <Badge>Paid</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"text-lg font-semibold mt-1 " + (tone === "danger" ? "text-destructive" : "")}>{value}</p>
    </CardContent></Card>
  );
}

function LedgerView({ rows, payments }: { rows: ScheduleRow[]; payments: Array<{ id: string; receipt_number: string; amount: number | string; payment_date: string; is_void: boolean }> }) {
  const entries: Array<{ date: string; ref: string; desc: string; debit: number; credit: number }> = [];
  for (const r of rows) {
    entries.push({ date: "", ref: "", desc: r.is_opening_balance ? "Opening Balance" : r.period_label, debit: Number(r.due_amount) - Number(r.concession_amount), credit: 0 });
  }
  for (const p of payments) {
    if (p.is_void) continue;
    entries.push({ date: p.payment_date, ref: p.receipt_number, desc: `Payment (${p.receipt_number})`, debit: 0, credit: Number(p.amount) });
  }
  entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  let bal = 0;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Date</TableHead><TableHead>Receipt #</TableHead><TableHead>Description</TableHead>
        <TableHead className="text-right">Debit</TableHead>
        <TableHead className="text-right">Credit</TableHead>
        <TableHead className="text-right">Balance</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {entries.length === 0 ? (
          <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No ledger entries yet.</TableCell></TableRow>
        ) : entries.map((e, i) => {
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
