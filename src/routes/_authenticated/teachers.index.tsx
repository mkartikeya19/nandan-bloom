import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, Plus, Search, ShieldAlert } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";
import { TeacherForm, type TeacherRecord } from "@/components/teachers/teacher-form";
import { formatSalary } from "@/lib/teachers-helpers";

export const Route = createFileRoute("/_authenticated/teachers/")({
  component: TeachersPage,
  head: () => ({
    meta: [
      { title: "Teacher Management — Nandan Kids ERP" },
      { name: "description", content: "Confidential employee master for teaching and non-teaching staff." },
      { property: "og:title", content: "Teacher Management — Nandan Kids ERP" },
      { property: "og:description", content: "Confidential employee master for teaching and non-teaching staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TeachersPage() {
  const perms = useUserRoles();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    enabled: perms.canManageTeachers,
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .order("employee_code", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TeacherRecord[];
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((t) => {
      if (t.is_archived) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [t.employee_code, t.full_name, t.phone, t.email, t.designation].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [data, q, statusFilter]);

  if (!perms.isLoading && !perms.canManageTeachers) {
    return (
      <div>
        <PageHeader title="Teacher Management" description="Confidential employee master." />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Teacher records contain confidential personal and financial information. Only a Super Admin can access this module.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Teacher Management"
        description="Master database of all employees. Super Admin access only."
        actions={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> Add teacher</Button>}
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by employee ID, name, mobile…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="border rounded-md px-3 py-2 bg-background text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No teachers yet"
          description="Add teaching and non-teaching staff with their employment, bank and document records."
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      <Link to="/teachers/$teacherId" params={{ teacherId: t.id }} className="text-primary hover:underline">
                        {t.employee_code}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link to="/teachers/$teacherId" params={{ teacherId: t.id }} className="hover:underline">
                        {t.full_name}
                      </Link>
                    </TableCell>
                    <TableCell>{t.designation ?? "—"}</TableCell>
                    <TableCell>{t.phone ?? "—"}</TableCell>
                    <TableCell>{t.date_of_joining ? new Date(t.date_of_joining).toLocaleDateString("en-IN") : "—"}</TableCell>
                    <TableCell>{formatSalary(t.monthly_salary)}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "Active" ? "default" : "secondary"}>{t.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <TeacherForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
