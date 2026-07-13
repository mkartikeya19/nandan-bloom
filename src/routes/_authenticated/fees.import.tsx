import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, Upload, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/fees-helpers";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/fees/import")({
  component: OpeningBalanceImport,
});

interface Row { scholar: string; session: string; amount: number; error?: string; recordId?: string }

function OpeningBalanceImport() {
  const qc = useQueryClient();
  const { canManageFeeStructures } = useUserRoles();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const template = () => {
    const ws = XLSX.utils.json_to_sheet([{ "Scholar Number": "1001", "Academic Session": "2025-2026", "Opening Balance": 5000 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OpeningBalances");
    XLSX.writeFile(wb, "opening-balance-template.xlsx");
  };

  const parse = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const parsed: Row[] = [];
    for (const r of raw) {
      const scholar = String(r["Scholar Number"] ?? "").trim();
      const session = String(r["Academic Session"] ?? "").trim();
      const amount = Number(r["Opening Balance"] ?? 0);
      if (!scholar || !session) { parsed.push({ scholar, session, amount, error: "Missing scholar or session" }); continue; }
      if (!(amount >= 0)) { parsed.push({ scholar, session, amount, error: "Invalid amount" }); continue; }
      const { data } = await supabase.from("students").select("id, student_academic_records(id, academic_sessions(name))").eq("scholar_number", scholar).maybeSingle();
      if (!data) { parsed.push({ scholar, session, amount, error: "Student not found" }); continue; }
      const rec = data.student_academic_records?.find((x) => x.academic_sessions?.name === session);
      if (!rec) { parsed.push({ scholar, session, amount, error: `No academic record for ${session}` }); continue; }
      parsed.push({ scholar, session, amount, recordId: rec.id });
    }
    setRows(parsed);
  };

  const commit = async () => {
    setBusy(true);
    try {
      const valid = rows.filter((r) => !r.error && r.recordId);
      let ok = 0;
      for (const r of valid) {
        const { error } = await supabase.from("student_academic_records").update({ opening_balance: r.amount }).eq("id", r.recordId!);
        if (error) { r.error = error.message; continue; }
        ok++;
      }
      setRows([...rows]);
      toast.success(`Imported ${ok} / ${valid.length}. Refresh each student's schedule to reflect the opening balance.`);
      qc.invalidateQueries({ queryKey: ["student-schedule"] });
    } finally { setBusy(false); }
  };

  const validCount = rows.filter((r) => !r.error).length;

  return (
    <div>
      <PageHeader title="Opening Balance Import" description="Import previous-session dues for existing students." actions={
        <>
          <Button variant="outline" onClick={template}><Download className="h-4 w-4" /> Template</Button>
          {canManageFeeStructures && rows.length > 0 && <Button onClick={commit} disabled={busy || validCount === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import {validCount} valid</Button>}
        </>
      } />
      <FeesTabs />
      <Card><CardContent className="p-4">
        <Input type="file" accept=".xlsx,.xls" disabled={!canManageFeeStructures} onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} className="mb-4" />
        {rows.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Scholar</TableHead><TableHead>Session</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono">{r.scholar}</TableCell>
                <TableCell>{r.session}</TableCell>
                <TableCell>{formatINR(r.amount)}</TableCell>
                <TableCell className={r.error ? "text-destructive text-sm" : "text-emerald-600 text-sm"}>{r.error ?? "Ready"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
