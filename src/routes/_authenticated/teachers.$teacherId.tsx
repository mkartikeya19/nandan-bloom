import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Archive, Pencil, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/use-user-role";
import { TeacherForm, type TeacherRecord } from "@/components/teachers/teacher-form";
import { TeacherDocuments } from "@/components/teachers/teacher-documents";
import { formatSalary, maskAccount } from "@/lib/teachers-helpers";
import { logActivity } from "@/lib/activity";
import { formatActivityDetails } from "@/lib/activity-format";

export const Route = createFileRoute("/_authenticated/teachers/$teacherId")({
  component: TeacherDetailPage,
  head: () => ({
    meta: [
      { title: "Teacher Profile — Nandan Kids ERP" },
      {
        name: "description",
        content: "Employee profile, bank details, documents and activity history.",
      },
      { property: "og:title", content: "Teacher Profile — Nandan Kids ERP" },
      {
        property: "og:description",
        content: "Employee profile, bank details, documents and activity history.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value ?? "—"}</span>
    </div>
  );
}

function TeacherDetailPage() {
  const { teacherId } = Route.useParams();
  const perms = useUserRoles();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data: teacher, isLoading } = useQuery({
    enabled: perms.canViewTeachers,
    queryKey: ["teacher", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", teacherId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TeacherRecord | null;
    },
  });

  const { data: activity } = useQuery({
    enabled: perms.canViewTeachers,
    queryKey: ["teacher-activity", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", "teacher")
        .eq("entity_id", teacherId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async () => {
      if (!teacher) return;
      const next = teacher.status === "Active" ? "Inactive" : "Active";
      const { error } = await supabase
        .from("teachers")
        .update({ status: next })
        .eq("id", teacher.id);
      if (error) throw error;
      await logActivity({
        module: "Teachers",
        action: "Status Changed",
        entityType: "teacher",
        entityId: teacher.id,
        details: { employee_code: teacher.employee_code, from: teacher.status, to: next },
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["teacher", teacherId] });
      qc.invalidateQueries({ queryKey: ["teacher-activity", teacherId] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async () => {
      if (!teacher) return;
      const { error } = await supabase
        .from("teachers")
        .update({ is_archived: true, status: "Inactive" })
        .eq("id", teacher.id);
      if (error) throw error;
      await logActivity({
        module: "Teachers",
        action: "Teacher Archived",
        entityType: "teacher",
        entityId: teacher.id,
        details: { employee_code: teacher.employee_code, full_name: teacher.full_name },
      });
    },
    onSuccess: () => {
      toast.success("Teacher archived");
      setArchiveOpen(false);
      qc.invalidateQueries({ queryKey: ["teacher", teacherId] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["teacher-activity", teacherId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const experience = useMemo(() => {
    if (teacher?.total_experience_years == null) return "—";
    return `${teacher.total_experience_years} year(s)`;
  }, [teacher]);

  if (!perms.isLoading && !perms.canViewTeachers) {
    return (
      <div>
        <PageHeader title="Teacher Profile" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>Only a Super Admin can access teacher records.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  if (!teacher)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Teacher not found.</CardContent>
      </Card>
    );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to="/teachers">
          <ArrowLeft className="h-4 w-4" /> Back to teachers
        </Link>
      </Button>

      <PageHeader
        title={teacher.full_name}
        description={`Employee ID ${teacher.employee_code}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={teacher.status === "Active" ? "default" : "secondary"}>
              {teacher.status}
            </Badge>
            {teacher.is_archived && <Badge variant="outline">Archived</Badge>}
            <Button
              variant="outline"
              onClick={() => toggleStatus.mutate()}
              disabled={toggleStatus.isPending}
            >
              Mark {teacher.status === "Active" ? "Inactive" : "Active"}
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {!teacher.is_archived && (
              <Button variant="destructive" onClick={() => setArchiveOpen(true)}>
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic information</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <Row
                label="Employee ID"
                value={<span className="font-mono">{teacher.employee_code}</span>}
              />
              <Row label="Full name" value={teacher.full_name} />
              <Row
                label="Date of joining"
                value={
                  teacher.date_of_joining
                    ? new Date(teacher.date_of_joining).toLocaleDateString("en-IN")
                    : "—"
                }
              />
              <Row label="Mobile number" value={teacher.phone} />
              <Row label="Email" value={teacher.email} />
              <Row label="Designation" value={teacher.designation} />
              <Row label="Qualification" value={teacher.qualification} />
              <Row label="Subject specialisation" value={teacher.subject_specialization} />
              <Row label="Gender" value={teacher.gender} />
              <Row
                label="Date of birth"
                value={
                  teacher.date_of_birth
                    ? new Date(teacher.date_of_birth).toLocaleDateString("en-IN")
                    : "—"
                }
              />
              <Row label="Address" value={teacher.address} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Government IDs</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <Row label="Aadhaar number" value={maskAccount(teacher.aadhaar_number)} />
                <Row label="PAN number" value={teacher.pan_number} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bank &amp; salary</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <Row label="Bank name" value={teacher.bank_name} />
                <Row label="Account holder" value={teacher.account_holder_name} />
                <Row label="Account number" value={maskAccount(teacher.account_number)} />
                <Row label="IFSC code" value={teacher.ifsc_code} />
                <Row label="Monthly salary" value={formatSalary(teacher.monthly_salary)} />
                <Row
                  label="Effective from"
                  value={
                    teacher.salary_effective_from
                      ? new Date(teacher.salary_effective_from).toLocaleDateString("en-IN")
                      : "—"
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Experience</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <Row label="Total experience" value={experience} />
                <Row label="Previous school" value={teacher.previous_school} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <TeacherDocuments
            teacherId={teacher.id}
            employeeCode={teacher.employee_code}
            canEdit={perms.canManageTeachers}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity log</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {(activity ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                (activity ?? []).map((a) => (
                  <div key={a.id} className="px-6 py-3">
                    <p className="text-sm font-medium">{a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("en-IN")} ·{" "}
                      {formatActivityDetails(
                        a.module,
                        a.action,
                        a.details as Record<string, unknown>,
                      )}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TeacherForm open={editOpen} onOpenChange={setEditOpen} teacher={teacher} />

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this teacher?</AlertDialogTitle>
            <AlertDialogDescription>
              {teacher.full_name} will be marked Inactive and hidden from the directory. The record
              is preserved for audit and can be restored by a Super Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archive.mutate()}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
