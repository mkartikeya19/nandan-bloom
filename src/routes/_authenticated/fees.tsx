import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fees")({
  component: FeesPage,
  head: () => ({ meta: [{ title: "Fee Management — School ERP" }] }),
});

function formatINR(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function FeesPage() {
  const payments = useQuery({
    queryKey: ["fee_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("id, receipt_number, amount, payment_mode, payment_date, term, academic_year, status, students(full_name, admission_number)")
        .order("payment_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const structures = useQuery({
    queryKey: ["fee_structures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_structures").select("*").order("class_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Fee Management"
        description="Fee structures and payment records for the academic session."
        actions={<Button><Plus className="h-4 w-4" /> Record payment</Button>}
      />

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          {payments.isLoading ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
          ) : !payments.data || payments.data.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No fee payments recorded"
              description="Record fee collections here. Receipts are auto-numbered per school policy."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.data.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                        <TableCell className="font-medium">
                          {p.students?.full_name ?? "—"}
                          <span className="block text-xs text-muted-foreground">
                            {p.students?.admission_number}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{formatINR(Number(p.amount))}</TableCell>
                        <TableCell className="capitalize">{p.payment_mode}</TableCell>
                        <TableCell>{p.term ?? "—"}</TableCell>
                        <TableCell>{new Date(p.payment_date).toLocaleDateString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="structures" className="mt-4">
          {structures.isLoading ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
          ) : !structures.data || structures.data.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No fee structures defined"
              description="Define fees per class and academic year (tuition, admission, exam, transport, etc.)."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {structures.data.map((s) => (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{s.class_name} · {s.academic_year}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Tuition</span><span>{formatINR(Number(s.tuition_fee))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Admission</span><span>{formatINR(Number(s.admission_fee))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Exam</span><span>{formatINR(Number(s.exam_fee))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Transport</span><span>{formatINR(Number(s.transport_fee))}</span></div>
                    <div className="flex justify-between pt-2 border-t font-semibold"><span>Total</span><span>{formatINR(Number(s.total_fee))}</span></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
