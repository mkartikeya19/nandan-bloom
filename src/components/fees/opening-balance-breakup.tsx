import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/fees-helpers";
import { Loader2 } from "lucide-react";

export interface BreakupRow {
  id: string;
  session_label: string | null;
  fee_head_label: string | null;
  amount: number | string;
  remarks: string | null;
  academic_sessions?: { name: string } | null;
  fee_heads?: { name: string } | null;
}

export function useOpeningBalanceBreakup(studentId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["opening-balance-breakup", studentId],
    enabled: !!studentId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_balance_details")
        .select("id, session_label, fee_head_label, amount, remarks, academic_sessions(name), fee_heads(name)")
        .eq("student_id", studentId!)
        .order("session_label", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BreakupRow[];
    },
  });
}

export function sessionOf(r: BreakupRow) {
  return r.academic_sessions?.name ?? r.session_label ?? "—";
}
export function headOf(r: BreakupRow) {
  return r.fee_heads?.name ?? r.fee_head_label ?? "—";
}

interface Props {
  studentId: string | null;
  studentName?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Reference-only view of migrated previous-session dues.
 * Never used in any financial calculation — the single Opening Balance
 * amount on the academic record remains the only figure the collection
 * engine sees.
 */
export function OpeningBalanceBreakupDialog({ studentId, studentName, open, onOpenChange }: Props) {
  const q = useOpeningBalanceBreakup(studentId, open);
  const rows = q.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Opening Balance Breakup</DialogTitle>
          <DialogDescription>
            Session-wise and fee-head-wise details of migrated dues
            {studentName ? ` for ${studentName}` : ""}. Reference only — this does not affect any calculation.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No migration breakup recorded for this student.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Fee Head</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{sessionOf(r)}</TableCell>
                    <TableCell>{headOf(r)}</TableCell>
                    <TableCell className="text-right">{formatINR(Number(r.amount))}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{formatINR(total)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
