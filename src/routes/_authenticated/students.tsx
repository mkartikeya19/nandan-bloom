import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "Students — School ERP" }] }),
});

function StudentsPage() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["students", q],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("id, admission_number, scholar_number, full_name, gender, guardian_phone, status")
        .order("created_at", { ascending: false })
        .limit(100);
      if (q) query = query.or(`full_name.ilike.%${q}%,admission_number.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Students"
        description="Directory of all enrolled students."
        actions={
          <Button>
            <Plus className="h-4 w-4" /> Add student
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or admission no." className="pl-9"
              value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add your first student manually or promote pending admissions to enrolled students."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Guardian phone</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.admission_number}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="capitalize">{s.gender ?? "—"}</TableCell>
                    <TableCell>{s.guardian_phone ?? "—"}</TableCell>
                    <TableCell>{s.academic_year ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
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
