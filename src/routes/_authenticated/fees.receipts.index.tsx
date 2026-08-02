import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Search, Download } from "lucide-react";
import { formatINR, PAYMENT_MODES } from "@/lib/fees-helpers";

export const Route = createFileRoute("/_authenticated/fees/receipts/")({
  component: ReceiptsPage,
  head: () => ({
    meta: [
      { title: "Receipts — Fee Management | School ERP" },
      {
        name: "description",
        content: "Search, filter, view, print and void fee receipts across sessions and classes.",
      },
      { property: "og:title", content: "Receipts — Fee Management" },
      {
        property: "og:description",
        content: "Search, filter, view, print and void fee receipts across sessions and classes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ALL = "__all__";

interface Row {
  id: string;
  receipt_number: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  is_void: boolean;
  academic_session_id: string | null;
  collected_by: string | null;
  student_name: string;
  scholar_number: string;
  mobile: string;
  class_name: string;
  section_name: string;
}

function ReceiptsPage() {
  const [q, setQ] = useState("");
  const [session, setSession] = useState(ALL);
  const [klass, setKlass] = useState(ALL);
  const [section, setSection] = useState(ALL);
  const [mode, setMode] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [collector, setCollector] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const sessions = useQuery({
    queryKey: ["sessions-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("id, name")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const profiles = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });
  const profileName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.data?.find((x) => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  const payments = useQuery({
    queryKey: ["all-receipts", from, to],
    queryFn: async () => {
      let query = supabase
        .from("fee_payments")
        .select(
          "id, receipt_number, amount, payment_mode, payment_date, is_void, academic_session_id, collected_by, students(scholar_number, full_name, father_mobile, mother_mobile, guardian_phone, student_academic_records(status, academic_session_id, school_classes(name), school_sections(name)))",
        )
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000);
      if (from) query = query.gte("payment_date", from);
      if (to) query = query.lte("payment_date", to);
      const { data, error } = await query;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data as any[]) ?? []).map((p): Row => {
        const s = p.students;
        const recs = s?.student_academic_records ?? [];

        const rec =
          recs.find((r: any) => r.academic_session_id === p.academic_session_id) ??
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recs.find((r: any) => r.status === "Active") ??
          recs[0];
        return {
          id: p.id,
          receipt_number: p.receipt_number,
          amount: Number(p.amount ?? 0),
          payment_mode: p.payment_mode,
          payment_date: p.payment_date,
          is_void: !!p.is_void,
          academic_session_id: p.academic_session_id ?? null,
          collected_by: p.collected_by ?? null,
          student_name: s?.full_name ?? "—",
          scholar_number: s?.scholar_number ?? "—",
          mobile: s?.father_mobile || s?.mother_mobile || s?.guardian_phone || "—",
          class_name: rec?.school_classes?.name ?? "—",
          section_name: rec?.school_sections?.name ?? "—",
        };
      });
    },
  });

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set((payments.data ?? []).map((r) => r.class_name).filter((c) => c !== "—")),
      ).sort(),
    [payments.data],
  );
  const sectionOptions = useMemo(
    () =>
      Array.from(
        new Set((payments.data ?? []).map((r) => r.section_name).filter((c) => c !== "—")),
      ).sort(),
    [payments.data],
  );
  const collectorOptions = useMemo(
    () =>
      Array.from(
        new Set((payments.data ?? []).map((r) => r.collected_by).filter(Boolean) as string[]),
      ),
    [payments.data],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (payments.data ?? []).filter((r) => {
      if (session !== ALL && r.academic_session_id !== session) return false;
      if (klass !== ALL && r.class_name !== klass) return false;
      if (section !== ALL && r.section_name !== section) return false;
      if (mode !== ALL && r.payment_mode !== mode) return false;
      if (status === "paid" && r.is_void) return false;
      if (status === "void" && !r.is_void) return false;
      if (collector !== ALL && r.collected_by !== collector) return false;
      if (!term) return true;
      return (
        r.receipt_number.toLowerCase().includes(term) ||
        r.student_name.toLowerCase().includes(term) ||
        r.scholar_number.toLowerCase().includes(term) ||
        r.mobile.toLowerCase().includes(term)
      );
    });
  }, [payments.data, q, session, klass, section, mode, status, collector]);

  const total = filtered.reduce((s, r) => s + (r.is_void ? 0 : r.amount), 0);

  const exportCsv = () => {
    const header = [
      "Receipt",
      "Date",
      "Student",
      "Scholar No",
      "Class",
      "Section",
      "Mode",
      "Amount",
      "Status",
      "Collected By",
    ];
    const lines = filtered.map((r) =>
      [
        r.receipt_number,
        r.payment_date,
        r.student_name,
        r.scholar_number,
        r.class_name,
        r.section_name,
        r.payment_mode,
        r.amount,
        r.is_void ? "Void" : "Paid",
        profileName(r.collected_by),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setQ("");
    setSession(ALL);
    setKlass(ALL);
    setSection(ALL);
    setMode(ALL);
    setStatus(ALL);
    setCollector(ALL);
    setFrom("");
    setTo("");
  };

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Every posted receipt, searchable and always accessible."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <FeesTabs />

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search receipt number, student name, scholar number or parent mobile"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">Session</Label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sessions</SelectItem>
                  {sessions.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={klass} onValueChange={setKlass}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All classes</SelectItem>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All sections</SelectItem>
                  {sectionOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All modes</SelectItem>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Collected by</Label>
              <Select value={collector} onValueChange={setCollector}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Anyone</SelectItem>
                  {collectorOptions.map((id) => (
                    <SelectItem key={id} value={id}>
                      {profileName(id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From date</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To date</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-muted-foreground">
              {filtered.length} receipt{filtered.length === 1 ? "" : "s"} · Net collected{" "}
              {formatINR(total)}
            </p>
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Collected by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading receipts…
                  </TableCell>
                </TableRow>
              ) : filtered.length ? (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">
                      <Link
                        to="/fees/receipts/$paymentId"
                        params={{ paymentId: r.id }}
                        className="text-primary hover:underline"
                      >
                        {r.receipt_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(r.payment_date).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>
                      {r.student_name}
                      <span className="block text-xs text-muted-foreground">
                        {r.scholar_number} · {r.mobile}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.class_name}
                      {r.section_name !== "—" ? ` · ${r.section_name}` : ""}
                    </TableCell>
                    <TableCell>{r.payment_mode}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatINR(r.amount)}
                    </TableCell>
                    <TableCell>
                      {r.is_void ? <Badge variant="destructive">Void</Badge> : <Badge>Paid</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profileName(r.collected_by)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/fees/receipts/$paymentId" params={{ paymentId: r.id }}>
                          <Eye className="h-4 w-4" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No receipts match these filters.
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
