import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Upload, Search, Users } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/admissions")({
  component: AdmissionRegisterPage,
  head: () => ({ meta: [{ title: "Admission Register — School ERP" }] }),
});

function AdmissionRegisterPage() {
  const perms = useUserRoles();
  const [q, setQ] = useState("");
  const [sessionId, setSessionId] = useState<string>("all");

  const { data: sessions } = useQuery({
    queryKey: ["ref-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("id, name")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ["admission-history", q, sessionId],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select(
          "id, scholar_number, full_name, father_name, gender, date_of_admission, admission_type, status, student_academic_records!left(academic_session_id, academic_sessions:academic_session_id(id,name))",
        )
        .order("date_of_admission", { ascending: false })
        .limit(200);
      if (q)
        query = query.or(
          `full_name.ilike.%${q}%,scholar_number.ilike.%${q}%,father_name.ilike.%${q}%`,
        );
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []).filter((s) => {
        if (sessionId === "all") return true;

        return (s.student_academic_records ?? []).some(
          (r) => r.academic_session_id === sessionId,
        );
      });
      return rows;
    },
  });

  const { data: reportData } = useQuery({
    queryKey: ["admission-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, date_of_admission, admission_type, status, gender")
        .limit(5000);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      const active = rows.filter((r) => r.status !== "Left").length;
      const left = rows.filter((r) => r.status === "Left").length;
      const byType = rows.reduce<Record<string, number>>((acc, r) => {
        const k = r.admission_type ?? "Unknown";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
      const thisYear = new Date().getFullYear();
      const thisYearCount = rows.filter(
        (r) => r.date_of_admission && new Date(r.date_of_admission).getFullYear() === thisYear,
      ).length;
      return { total, active, left, byType, thisYearCount };
    },
  });

  return (
    <div>
      <PageHeader
        title="Admission Register"
        description="Manage admissions handled directly by the office."
        actions={
          perms.canCreateStudent && (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/students/import">
                  <Upload className="h-4 w-4" /> Import Students
                </Link>
              </Button>
              <Button asChild>
                <Link to="/students/new">
                  <Plus className="h-4 w-4" /> New Admission
                </Link>
              </Button>
            </div>
          )
        }
      />

      <Tabs defaultValue="admissions">
        <TabsList>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
          <TabsTrigger value="import">Import Students</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="admissions" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-3 flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name, scholar no. or father's name"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <select
                className="border rounded-md px-3 py-2 bg-background"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="all">All sessions</option>
                {sessions?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scholar No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Admitted On</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : !history?.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No admissions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.scholar_number}</TableCell>
                        <TableCell className="font-medium">
                          <Link
                            to="/students/$studentId"
                            params={{ studentId: s.id }}
                            className="hover:underline"
                          >
                            {s.full_name}
                          </Link>
                        </TableCell>
                        <TableCell>{s.father_name ?? "—"}</TableCell>
                        <TableCell className="capitalize">{s.gender ?? "—"}</TableCell>
                        <TableCell>
                          {s.date_of_admission
                            ? new Date(s.date_of_admission).toLocaleDateString("en-IN")
                            : "—"}
                        </TableCell>
                        <TableCell>{s.admission_type ?? "—"}</TableCell>
                        <TableCell>{s.status ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <Card>
            <CardContent className="p-6 flex flex-col items-start gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> Bulk-import existing students from Excel.
              </div>
              <Button asChild>
                <Link to="/students/import">
                  <Upload className="h-4 w-4" /> Open Import
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Total Admissions</p>
                <p className="text-2xl font-semibold mt-1">{reportData?.total ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-semibold mt-1">{reportData?.active ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Left</p>
                <p className="text-2xl font-semibold mt-1">{reportData?.left ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">Admitted This Year</p>
                <p className="text-2xl font-semibold mt-1">{reportData?.thisYearCount ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
          {reportData && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <p className="text-sm font-medium mb-2">By Admission Type</p>
                <div className="space-y-1 text-sm">
                  {Object.entries(reportData.byType).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
