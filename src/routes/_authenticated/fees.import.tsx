import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Upload, Loader2, Plus, Trash2, Save, Eye, Search } from "lucide-react";
import { formatINR } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";
import { logActivity } from "@/lib/activity";
import { OpeningBalanceBreakupDialog } from "@/components/fees/opening-balance-breakup";

export const Route = createFileRoute("/_authenticated/fees/import")({
  component: OpeningBalanceMigration,
  head: () => ({
    meta: [
      { title: "Opening Balance Migration — Nandan Kids ERP" },
      { name: "description", content: "Migrate previous-session dues with a session-wise and fee-head-wise breakup for every student." },
      { property: "og:title", content: "Opening Balance Migration — Nandan Kids ERP" },
      { property: "og:description", content: "Import, review and finalize migrated opening balances with full audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface BreakupDraft {
  key: string;
  sessionId: string | null;
  sessionLabel: string;
  feeHeadId: string | null;
  feeHeadLabel: string;
  amount: number;
  remarks: string;
}

interface ImportRow {
  key: string;
  scholar: string;
  recordSession: string;
  breakupSession: string;
  feeHead: string;
  amount: number;
  remarks: string;
  error?: string;
  studentId?: string;
  recordId?: string;
  sessionId?: string | null;
  feeHeadId?: string | null;
}

const uid = () => Math.random().toString(36).slice(2);

function OpeningBalanceMigration() {
  const { canManageFeeStructures } = useUserRoles();
  return (
    <div>
      <PageHeader
        title="Opening Balance Migration"
        description="Migrate previous-session dues and preserve their session-wise, fee-head-wise breakup. The collection engine continues to use only the single Opening Balance amount."
      />
      <FeesTabs />
      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="import">Bulk Import (Excel)</TabsTrigger>
          <TabsTrigger value="report">Opening Balance Report</TabsTrigger>
        </TabsList>
        <TabsContent value="manual"><ManualEntry canEdit={canManageFeeStructures} /></TabsContent>
        <TabsContent value="import"><BulkImport canEdit={canManageFeeStructures} /></TabsContent>
        <TabsContent value="report"><OpeningBalanceReport /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------ shared data ------------------------------ */

function useSessions() {
  return useQuery({
    queryKey: ["ob-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("id, name").order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useFeeHeads() {
  return useQuery({
    queryKey: ["ob-fee-heads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_heads").select("id, name").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------ manual entry ----------------------------- */

function ManualEntry({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const sessions = useSessions();
  const feeHeads = useFeeHeads();
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string; scholar: string } | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [rows, setRows] = useState<BreakupDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const results = useQuery({
    queryKey: ["ob-student-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const t = term.trim();
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, scholar_number")
        .or(`full_name.ilike.%${t}%,scholar_number.ilike.%${t}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const loadStudent = async (stu: { id: string; full_name: string; scholar_number: string }) => {
    setSelected({ id: stu.id, name: stu.full_name, scholar: stu.scholar_number });
    setTerm("");
    const { data: rec } = await supabase
      .from("student_academic_records")
      .select("id, opening_balance, status, academic_sessions(name)")
      .eq("student_id", stu.id)
      .eq("status", "Active")
      .maybeSingle();
    setRecordId(rec?.id ?? null);
    const { data: details } = await supabase
      .from("opening_balance_details")
      .select("id, academic_session_id, session_label, fee_head_id, fee_head_label, amount, remarks")
      .eq("student_id", stu.id)
      .order("created_at");
    setRows(
      (details ?? []).map((d) => ({
        key: d.id,
        sessionId: d.academic_session_id,
        sessionLabel: d.session_label ?? "",
        feeHeadId: d.fee_head_id,
        feeHeadLabel: d.fee_head_label ?? "",
        amount: Number(d.amount),
        remarks: d.remarks ?? "",
      })),
    );
  };

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const save = async () => {
    if (!selected) return;
    if (!recordId) { toast.error("This student has no Active academic record to attach the opening balance to."); return; }
    setSaving(true);
    try {
      const existed = (await supabase.from("opening_balance_details").select("id").eq("student_id", selected.id)).data?.length ?? 0;
      const { error: delErr } = await supabase.from("opening_balance_details").delete().eq("student_id", selected.id);
      if (delErr) throw delErr;
      if (rows.length) {
        const payload = rows.map((r) => ({
          student_id: selected.id,
          academic_record_id: recordId,
          academic_session_id: r.sessionId,
          session_label: r.sessionId ? null : (r.sessionLabel || null),
          fee_head_id: r.feeHeadId,
          fee_head_label: r.feeHeadId ? null : (r.feeHeadLabel || null),
          amount: Number(r.amount) || 0,
          remarks: r.remarks || null,
          source: "Manual",
        }));
        const { error } = await supabase.from("opening_balance_details").insert(payload);
        if (error) throw error;
      }
      const { error: upErr } = await supabase
        .from("student_academic_records")
        .update({ opening_balance: total })
        .eq("id", recordId);
      if (upErr) throw upErr;

      await logActivity({
        module: "Fees",
        action: existed > 0 ? "Opening Balance Updated" : "Opening Balance Created",
        entityType: "student",
        entityId: selected.id,
        details: {
          student_name: selected.name,
          scholar_number: selected.scholar,
          amount: total,
          breakup_rows: rows.length,
          entry_mode: "Manual Entry",
          remarks: rows.map((r) => r.remarks).filter(Boolean).join("; ") || null,
        },
      });

      toast.success(`Opening Balance saved — ${formatINR(total)} across ${rows.length} breakup row${rows.length === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["opening-balance-breakup", selected.id] });
      qc.invalidateQueries({ queryKey: ["ob-report"] });
      qc.invalidateQueries({ queryKey: ["student-schedule"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3"><CardTitle className="text-base">Manual Entry</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Find student</Label>
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search by name or scholar number…" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          {term.trim().length >= 2 && (
            <div className="max-w-md rounded-md border divide-y">
              {results.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Searching…</p>
              ) : !results.data?.length ? (
                <p className="p-3 text-sm text-muted-foreground">No students found.</p>
              ) : results.data.map((s) => (
                <button key={s.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => loadStudent(s)}>
                  {s.full_name} <span className="font-mono text-xs text-muted-foreground">· {s.scholar_number}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{selected.name}</p>
                <p className="font-mono text-xs text-muted-foreground">Scholar {selected.scholar}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Opening Balance (total of breakup)</p>
                <p className="text-lg font-semibold">{formatINR(total)}</p>
              </div>
            </div>

            {!recordId && <p className="text-sm text-destructive">No Active academic record — cannot store an opening balance for this student.</p>}

            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[22%]">Session</TableHead>
                <TableHead className="w-[22%]">Fee Head</TableHead>
                <TableHead className="w-[16%]">Amount</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-10" />
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No breakup rows yet.</TableCell></TableRow>
                ) : rows.map((r, i) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <Select
                        value={r.sessionId ?? ""}
                        onValueChange={(v) => setRows((p) => p.map((x, j) => j === i ? { ...x, sessionId: v, sessionLabel: sessions.data?.find((s) => s.id === v)?.name ?? "" } : x))}
                        disabled={!canEdit}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(sessions.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.feeHeadId ?? ""}
                        onValueChange={(v) => setRows((p) => p.map((x, j) => j === i ? { ...x, feeHeadId: v, feeHeadLabel: feeHeads.data?.find((h) => h.id === v)?.name ?? "" } : x))}
                        disabled={!canEdit}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(feeHeads.data ?? []).map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} value={r.amount} disabled={!canEdit}
                        onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                    </TableCell>
                    <TableCell>
                      <Input value={r.remarks} disabled={!canEdit} placeholder="Optional"
                        onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, remarks: e.target.value } : x))} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setRows((p) => [...p, { key: uid(), sessionId: null, sessionLabel: "", feeHeadId: null, feeHeadLabel: "", amount: 0, remarks: "" }])}>
                  <Plus className="h-4 w-4" /> Add Row
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !recordId}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Finalize — set Opening Balance {formatINR(total)}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------ bulk import ------------------------------ */

function BulkImport({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const sessions = useSessions();
  const feeHeads = useFeeHeads();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);

  const template = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Scholar Number": "1001", "Academic Session": "2026-2027", "Due Session": "2024-2025", "Fee Head": "Admission Fee", "Amount": 2000, "Remarks": "Carried forward" },
      { "Scholar Number": "1001", "Academic Session": "2026-2027", "Due Session": "2025-2026", "Fee Head": "Tuition Fee", "Amount": 6000, "Remarks": "" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OpeningBalances");
    XLSX.writeFile(wb, "opening-balance-breakup-template.xlsx");
  };

  const parse = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const parsed: ImportRow[] = [];
    for (const r of raw) {
      const scholar = String(r["Scholar Number"] ?? "").trim();
      const recordSession = String(r["Academic Session"] ?? "").trim();
      const breakupSession = String(r["Due Session"] ?? "").trim();
      const feeHead = String(r["Fee Head"] ?? "").trim();
      const remarks = String(r["Remarks"] ?? "").trim();
      const amount = Number(r["Amount"] ?? 0);
      const base: ImportRow = { key: uid(), scholar, recordSession, breakupSession, feeHead, amount, remarks };
      if (!scholar || !recordSession) { parsed.push({ ...base, error: "Missing scholar or academic session" }); continue; }
      if (!(amount >= 0)) { parsed.push({ ...base, error: "Invalid amount" }); continue; }
      const { data } = await supabase
        .from("students")
        .select("id, student_academic_records(id, academic_sessions(name))")
        .eq("scholar_number", scholar)
        .maybeSingle();
      if (!data) { parsed.push({ ...base, error: "Student not found" }); continue; }
      const rec = data.student_academic_records?.find((x) => x.academic_sessions?.name === recordSession);
      if (!rec) { parsed.push({ ...base, error: `No academic record for ${recordSession}` }); continue; }
      const sessionId = sessions.data?.find((s) => s.name.toLowerCase() === breakupSession.toLowerCase())?.id ?? null;
      const feeHeadId = feeHeads.data?.find((h) => h.name.toLowerCase() === feeHead.toLowerCase())?.id ?? null;
      parsed.push({ ...base, studentId: data.id, recordId: rec.id, sessionId, feeHeadId });
    }
    setRows(parsed);
  };

  const valid = rows.filter((r) => !r.error && r.recordId);
  const grouped = useMemo(() => {
    const m = new Map<string, { scholar: string; studentId: string; recordId: string; total: number; count: number }>();
    for (const r of valid) {
      const g = m.get(r.scholar) ?? { scholar: r.scholar, studentId: r.studentId!, recordId: r.recordId!, total: 0, count: 0 };
      g.total += Number(r.amount) || 0;
      g.count += 1;
      m.set(r.scholar, g);
    }
    return [...m.values()];
  }, [rows]);

  const commit = async () => {
    setBusy(true);
    try {
      let ok = 0;
      for (const g of grouped) {
        const mine = valid.filter((r) => r.scholar === g.scholar);
        await supabase.from("opening_balance_details").delete().eq("student_id", g.studentId);
        const { error } = await supabase.from("opening_balance_details").insert(
          mine.map((r) => ({
            student_id: g.studentId,
            academic_record_id: g.recordId,
            academic_session_id: r.sessionId,
            session_label: r.sessionId ? null : (r.breakupSession || null),
            fee_head_id: r.feeHeadId,
            fee_head_label: r.feeHeadId ? null : (r.feeHead || null),
            amount: Number(r.amount) || 0,
            remarks: r.remarks || null,
            source: "Excel Import",
          })),
        );
        if (error) { toast.error(`${g.scholar}: ${error.message}`); continue; }
        const { error: upErr } = await supabase.from("student_academic_records").update({ opening_balance: g.total }).eq("id", g.recordId);
        if (upErr) { toast.error(`${g.scholar}: ${upErr.message}`); continue; }
        ok++;
        await logActivity({
          module: "Fees",
          action: "Opening Balance Imported",
          entityType: "student",
          entityId: g.studentId,
          details: { scholar_number: g.scholar, amount: g.total, breakup_rows: g.count, entry_mode: "Imported via Excel" },
        });
        qc.invalidateQueries({ queryKey: ["opening-balance-breakup", g.studentId] });
      }
      toast.success(`Imported opening balances for ${ok} / ${grouped.length} student${grouped.length === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["ob-report"] });
      qc.invalidateQueries({ queryKey: ["student-schedule"] });
    } finally { setBusy(false); }
  };

  return (
    <Card className="mt-4"><CardContent className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={template}><Download className="h-4 w-4" /> Template</Button>
        {canEdit && grouped.length > 0 && (
          <Button onClick={commit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Finalize {grouped.length} student{grouped.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>
      <Input type="file" accept=".xlsx,.xls" disabled={!canEdit} onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} />
      <p className="text-xs text-muted-foreground">
        One row per due. Multiple rows per scholar number are combined — their sum becomes the student&apos;s Opening Balance, and each row is stored as a breakup entry. Edit or remove rows below before finalizing.
      </p>

      {rows.length > 0 && (
        <>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Scholar</TableHead><TableHead>Record Session</TableHead><TableHead>Due Session</TableHead>
              <TableHead>Fee Head</TableHead><TableHead className="w-32">Amount</TableHead><TableHead>Status</TableHead><TableHead className="w-10" />
            </TableRow></TableHeader>
            <TableBody>{rows.map((r, i) => (
              <TableRow key={r.key}>
                <TableCell className="font-mono">{r.scholar}</TableCell>
                <TableCell>{r.recordSession}</TableCell>
                <TableCell>{r.breakupSession || "—"}</TableCell>
                <TableCell>{r.feeHead || "—"}</TableCell>
                <TableCell>
                  <Input type="number" min={0} value={r.amount} disabled={!canEdit}
                    onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                </TableCell>
                <TableCell className={r.error ? "text-sm text-destructive" : "text-sm text-emerald-600"}>{r.error ?? "Ready"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" disabled={!canEdit} onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>

          {grouped.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Preview — resulting Opening Balance</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {grouped.map((g) => (
                  <span key={g.scholar} className="rounded bg-muted px-2 py-1">
                    <span className="font-mono">{g.scholar}</span>: <strong>{formatINR(g.total)}</strong> ({g.count} rows)
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </CardContent></Card>
  );
}

/* --------------------------------- report -------------------------------- */

function OpeningBalanceReport() {
  const [viewStudent, setViewStudent] = useState<{ id: string; name: string } | null>(null);

  const q = useQuery({
    queryKey: ["ob-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_academic_records")
        .select("id, opening_balance, student_id, students(full_name, scholar_number), school_classes(name), academic_sessions(name)")
        .gt("opening_balance", 0)
        .eq("status", "Active");
      if (error) throw error;
      const recs = data ?? [];
      const ids = recs.map((r) => r.student_id);
      const [detailsRes, scheduleRes] = await Promise.all([
        ids.length ? supabase.from("opening_balance_details").select("student_id, session_label, academic_sessions(name)").in("student_id", ids) : Promise.resolve({ data: [] as never[] }),
        ids.length ? supabase.from("student_fee_schedule").select("student_id, due_amount, concession_amount, paid_amount").in("student_id", ids) : Promise.resolve({ data: [] as never[] }),
      ]);
      const sessionsBy = new Map<string, Set<string>>();
      for (const d of (detailsRes.data ?? []) as Array<{ student_id: string; session_label: string | null; academic_sessions?: { name: string } | null }>) {
        const label = d.academic_sessions?.name ?? d.session_label;
        if (!label) continue;
        const set = sessionsBy.get(d.student_id) ?? new Set<string>();
        set.add(label);
        sessionsBy.set(d.student_id, set);
      }
      const outBy = new Map<string, number>();
      for (const s of (scheduleRes.data ?? []) as Array<{ student_id: string; due_amount: number | string; concession_amount: number | string; paid_amount: number | string }>) {
        const os = Math.max(0, Number(s.due_amount) - Number(s.concession_amount) - Number(s.paid_amount));
        outBy.set(s.student_id, (outBy.get(s.student_id) ?? 0) + os);
      }
      return recs.map((r) => ({
        id: r.id,
        studentId: r.student_id,
        name: r.students?.full_name ?? "—",
        scholar: r.students?.scholar_number ?? "—",
        className: r.school_classes?.name ?? "—",
        opening: Number(r.opening_balance ?? 0),
        prevSessions: [...(sessionsBy.get(r.student_id) ?? [])].sort().join(", ") || "—",
        outstanding: outBy.get(r.student_id) ?? 0,
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const exportCsv = () => {
    const rows = q.data ?? [];
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      "Scholar Number": r.scholar, "Student Name": r.name, "Current Class": r.className,
      "Opening Balance": r.opening, "Previous Session(s)": r.prevSessions, "Total Outstanding": r.outstanding,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OpeningBalanceReport");
    XLSX.writeFile(wb, "opening-balance-report.xlsx");
  };

  const rows = q.data ?? [];

  return (
    <Card className="mt-4"><CardContent className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} student{rows.length === 1 ? "" : "s"} with a migrated opening balance.</p>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export</Button>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Scholar Number</TableHead><TableHead>Student Name</TableHead><TableHead>Current Class</TableHead>
          <TableHead className="text-right">Opening Balance</TableHead><TableHead>Previous Session(s)</TableHead>
          <TableHead className="text-right">Total Outstanding</TableHead><TableHead className="w-24" />
        </TableRow></TableHeader>
        <TableBody>
          {q.isLoading ? (
            <TableRow><TableCell colSpan={7} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
          ) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No opening balances recorded.</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setViewStudent({ id: r.studentId, name: r.name })}>
              <TableCell className="font-mono">{r.scholar}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.className}</TableCell>
              <TableCell className="text-right font-semibold">{formatINR(r.opening)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.prevSessions}</TableCell>
              <TableCell className="text-right">{formatINR(r.outstanding)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setViewStudent({ id: r.studentId, name: r.name }); }}>
                  <Eye className="h-4 w-4" /> Breakup
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <OpeningBalanceBreakupDialog
        studentId={viewStudent?.id ?? null}
        studentName={viewStudent?.name}
        open={!!viewStudent}
        onOpenChange={(v) => !v && setViewStudent(null)}
      />
    </CardContent></Card>
  );
}
