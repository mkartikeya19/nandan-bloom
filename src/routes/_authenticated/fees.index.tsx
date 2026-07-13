import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { formatINR } from "@/lib/fees-helpers";
import { Wallet, Calendar, AlertCircle, Users, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fees/")({
  component: FeesDashboard,
  head: () => ({ meta: [{ title: "Fee Management — School ERP" }] }),
});

function FeesDashboard() {
  const stats = useQuery({
    queryKey: ["fee-dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [todayRes, monthRes, outstandingRes, pendingRes, todayCountRes] = await Promise.all([
        supabase.from("fee_payments").select("amount").eq("payment_date", today).eq("is_void", false),
        supabase.from("fee_payments").select("amount").gte("payment_date", monthStartStr).eq("is_void", false),
        supabase.from("student_fee_schedule").select("due_amount, concession_amount, paid_amount"),
        supabase.from("student_fee_schedule").select("student_id").in("status", ["Pending", "Partial"]),
        supabase.from("fee_payments").select("id", { count: "exact", head: true }).eq("payment_date", today).eq("is_void", false),
      ]);

      const todaySum = (todayRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const monthSum = (monthRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const outstanding = (outstandingRes.data ?? []).reduce(
        (s, r) => s + Math.max(0, Number(r.due_amount ?? 0) - Number(r.concession_amount ?? 0) - Number(r.paid_amount ?? 0)),
        0,
      );
      const pendingStudents = new Set((pendingRes.data ?? []).map((r) => r.student_id)).size;
      return {
        todayCollection: todaySum,
        monthCollection: monthSum,
        outstanding,
        pendingStudents,
        receiptsToday: todayCountRes.count ?? 0,
      };
    },
  });

  const recent = useQuery({
    queryKey: ["fee-recent-receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("id, receipt_number, amount, payment_mode, payment_date, is_void, students(full_name, scholar_number)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const cards = [
    { label: "Today's Collection", value: formatINR(stats.data?.todayCollection ?? 0), icon: Wallet },
    { label: "This Month", value: formatINR(stats.data?.monthCollection ?? 0), icon: Calendar },
    { label: "Outstanding", value: formatINR(stats.data?.outstanding ?? 0), icon: AlertCircle },
    { label: "Students with Pending Fee", value: String(stats.data?.pendingStudents ?? 0), icon: Users },
    { label: "Receipts Today", value: String(stats.data?.receiptsToday ?? 0), icon: Receipt },
  ];

  return (
    <div>
      <PageHeader
        title="Fee Management"
        description="Fee structures, collections and concessions."
        actions={<Button asChild><Link to="/fees/collect">Collect Fee</Link></Button>}
      />
      <FeesTabs />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-semibold mt-1">{c.value}</p>
              </div>
              <c.icon className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Receipts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.data?.length ? recent.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">
                    <Link to="/fees/receipts/$paymentId" params={{ paymentId: p.id }} className="text-primary hover:underline">
                      {p.receipt_number}
                    </Link>
                  </TableCell>
                  <TableCell>{p.students?.full_name ?? "—"} <span className="text-xs text-muted-foreground">({p.students?.scholar_number})</span></TableCell>
                  <TableCell className="font-semibold">{formatINR(Number(p.amount))}</TableCell>
                  <TableCell>{p.payment_mode}</TableCell>
                  <TableCell>{new Date(p.payment_date).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>{p.is_void ? <Badge variant="destructive">Void</Badge> : <Badge>Paid</Badge>}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No receipts yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
