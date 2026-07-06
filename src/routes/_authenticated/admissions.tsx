import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admissions")({
  component: AdmissionsPage,
  head: () => ({ meta: [{ title: "Admissions — School ERP" }] }),
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  waitlisted: "outline",
};

function AdmissionsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissions")
        .select("*")
        .order("applied_on", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Admissions"
        description="Manage new admission applications and enrolment status."
        actions={<Button><Plus className="h-4 w-4" /> New application</Button>}
      />

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No applications yet"
          description="Applications submitted through the admission form will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App. No.</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Guardian phone</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.application_number}</TableCell>
                    <TableCell className="font-medium">{a.applicant_name}</TableCell>
                    <TableCell>{a.applying_for_class}</TableCell>
                    <TableCell>{a.academic_year}</TableCell>
                    <TableCell>{a.guardian_phone}</TableCell>
                    <TableCell>{new Date(a.applied_on).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status] ?? "secondary"} className="capitalize">
                        {a.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
