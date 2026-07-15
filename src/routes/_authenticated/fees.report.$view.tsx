import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Search, Wallet } from "lucide-react";
import { formatINR } from "@/lib/fees-helpers";

type View = "pending" | "today" | "month" | "outstanding" | "receipts";

const TITLES: Record<View, { title: string; description: string }> = {
  pending: { title: "Students with Pending Fee", description: "Active students who still owe fees for the current session." },
  today: { title: "Today's Collection", description: "Receipts collected today." },
  month: { title: "This Month's Collection", description: "Receipts collected this month." },
  outstanding: { title: "Outstanding Fees", description: "All active students with outstanding balances." },
  receipts: { title: "All Receipts", description: "Recent receipts across the school." },
};

export const Route = createFileRoute("/_authenticated/fees/report/$view")({
  component: FeeReportPage,
  head: ({ params }) => {
    const t = TITLES[(params.view as View) ?? "pending"] ?? TITLES.pending;
    return { meta: [{ title: `${t.title} — School ERP` }] };
  },
});

function FeeReportPage() {
  const { view: rawView } = Route.useParams();
  const view = (["pending","today","month","outstanding","receipts"].includes(rawView) ? rawView : "pending") as View;
  const nav = useNavigate();
  const [q, setQ] = useState("");

  const isReceipts = view === "today" || view === "month" || view === "receipts";

  const rows = useQuery({
    queryKey: ["fee-report", view],
    queryFn: async () => {
      if (isReceipts) {
        let query = supabase
          .from("fee_payments")
          .select("id, receipt_number, amount, payment_mode, payment_date, is_void, students(id, scholar_number, full_name, father_name)")
          .eq("is_void", false)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1000);
        if (view === "today") {
          const today = new Date().toISOString().slice(0, 10);
          query = query.eq("payment_date", today);
        } else if (view === "month") {
          const start = new Date();
          start.setDate(1);
          query = query.gte("payment_date", start.toISOString().slice(0, 10));
        }
        const { data, error } = await query;
        if (error) throw error;
        return data ?? [];
      }
      // pending / outstanding — aggregate per student
      const { data: sched, error } = await supabase
        .from("student_fee_schedule")
        .select("student_id, due_amount, concession_amount, paid_amount, students!inner(id, scholar_number, full_name, father_name, father_mobile, mother_mobile, guardian_phone, status, student_academic_records(academic_session_id, status, school_classes(name), school_sections(name), opening_balance))")
        .in("status", ["Pending", "Partial"]);
      if (error) throw error;
      const byStudent = new Map<string, {
        student_id: string;
        scholar_number: string;
        full_name: string;
        father_name: string | null;
        mobile: string | null;
        class_name: string;
        section_name: string;
        opening_balance: number;
        pending: number;
      }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sched as any[] ?? []).forEach((r) => {
        const s = r.students;
        if (!s || s.status === "Left") return;
        const active = (s.student_academic_records ?? []).find((a: { status: string }) => a.status === "Active") ?? s.student_academic_records?.[0];
        const outstanding = Math.max(0, Number(r.due_amount ?? 0) - Number(r.concession_amount ?? 0) - Number(r.paid_amount ?? 0));
        if (outstanding <= 0) return;
        const existing = byStudent.get(s.id);
        if (existing) {
          existing.pending += outstanding;
        } else {
          byStudent.set(s.id, {
            student_id: s.id,
            scholar_number: s.scholar_number,
            full_name: s.full_name,
            father_name: s.father_name ?? null,
            mobile: s.father_mobile ?? s.mother_mobile ?? s.guardian_phone ?? null,
            class_name: active?.school_classes?.name ?? "—",
            section_name: active?.school_sections?.name ?? "—",
            opening_balance: Number(active?.opening_balance ?? 0),
            pending: outstanding,
          });
        }
      });
      return Array.from(byStudent.values()).sort((a, b) => b.pending - a.pending);
    },
  });

  // Last payment date per student for pending view
  const studentIds = useMemo(
    () => (!isReceipts && rows.data ? (rows.data as Array<{ student_id: string }>).map((r) => r.student_id) : []),
    [isReceipts, rows.data],
  );
  const lastPayments = useQuery({
    enabled: studentIds.length > 0,
    queryKey: ["fee-report-last-pay", studentIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("student_id, payment_date")
        .in("student_id", studentIds)
        .eq("is_void", false)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((p) => { if (!map.has(p.student_id)) map.set(p.student_id, p.payment_date); });
      return map;
    },
  });

  const filtered = useMemo(() => {
    if (!rows.data) return [];
    const needle = q.toLowerCase().trim();
    if (!needle) return rows.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows.data as any[]).filter((r) => {
      if (isReceipts) {
        return [r.receipt_number, r.students?.full_name, r.students?.scholar_number, r.payment_mode].some((v) => String(v ?? "").toLowerCase().includes(needle));
      }
      return [r.full_name, r.scholar_number, r.father_name, r.class_name, r.mobile].some((v) => String(v ?? "").toLowerCase().includes(needle));
    });
  }, [rows.data, q, isReceipts]);

  const total = useMemo(() => {
    if (!filtered) return 0;
    if (isReceipts) return (filtered as Array<{ amount: number | string }>).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return (filtered as Array<{ pending: number }>).reduce((s, r) => s + r.pending, 0);
  }, [filtered, isReceipts]);

  const exportCsv = () => {
    let header: string[] = [];
    let body: string[][] = [];
    if (isReceipts) {
      header = ["Date", "Receipt", "Student", "Scholar", "Amount", "Mode"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body = (filtered as any[]).map((r) => [
        r.payment_date, r.receipt_number, r.students?.full_name ?? "", r.students?.scholar_number ?? "",
        String(r.amount), r.payment_mode,
      ]);
    } else {
      header = ["Scholar", "Student", "Father", "Class", "Section", "Mobile", "Opening Balance", "Pending", "Last Payment"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body = (filtered as any[]).map((r) => [
        r.scholar_number, r.full_name, r.father_name ?? "", r.class_name, r.section_name, r.mobile ?? "",
        String(r.opening_balance), String(r.pending), lastPayments.data?.get(r.student_id) ?? "",
      ]);
    }
    const csv = [header, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `fees-${view}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const t = TITLES[view];

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/fees"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export</Button>
          </div>
        }
      />
      <FeesTabs />
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">Total:</span>
            <Badge variant="secondary">{isReceipts ? formatINR(total) : `${filtered.length} students · ${formatINR(total)} pending`}</Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isReceipts ? (
                  <>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </>
                ) : (
                  <>
                    <TableHead>Scholar</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead />
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No records.</TableCell></TableRow>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ) : (filtered as any[]).map((r) => isReceipts ? (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.payment_date).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link to="/fees/receipts/$paymentId" params={{ paymentId: r.id }} className="text-primary hover:underline">
                      {r.receipt_number}
                    </Link>
                  </TableCell>
                  <TableCell>{r.students?.full_name} <span className="text-xs text-muted-foreground">({r.students?.scholar_number})</span></TableCell>
                  <TableCell>{r.payment_mode}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(Number(r.amount))}</TableCell>
                  <TableCell />
                </TableRow>
              ) : (
                <TableRow key={r.student_id}>
                  <TableCell className="font-mono text-xs">{r.scholar_number}</TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>{r.father_name ?? "—"}</TableCell>
                  <TableCell>{r.class_name}</TableCell>
                  <TableCell>{r.section_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.mobile ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatINR(r.opening_balance)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">{formatINR(r.pending)}</TableCell>
                  <TableCell className="text-xs">{lastPayments.data?.get(r.student_id) ? new Date(lastPayments.data.get(r.student_id)!).toLocaleDateString("en-IN") : "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => nav({ to: "/fees/collect/$studentId", params: { studentId: r.student_id } })}>
                      <Wallet className="h-3.5 w-3.5" /> Collect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
