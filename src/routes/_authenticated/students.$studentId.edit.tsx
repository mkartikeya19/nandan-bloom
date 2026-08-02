import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { StudentForm } from "@/components/students/student-form";
import { useUserRoles } from "@/hooks/use-user-role";
import type { StudentStatus } from "@/lib/students-helpers";

export const Route = createFileRoute("/_authenticated/students/$studentId/edit")({
  component: EditStudentPage,
  head: () => ({ meta: [{ title: "Edit Student — School ERP" }] }),
});

function EditStudentPage() {
  const { studentId } = Route.useParams();
  const nav = useNavigate();
  const perms = useUserRoles();

  const { data, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data: s, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      const { data: recs } = await supabase
        .from("student_academic_records")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1);
      return { student: s, current: recs?.[0] ?? null };
    },
  });

  if (!perms.isLoading && !perms.canEditStudent) {
    return (
      <div>
        <PageHeader
          title="Edit Student"
          description="You do not have permission to edit students."
        />
        <Button asChild variant="outline">
          <Link to="/students">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Edit — ${data.student.full_name}`}
        description={`Scholar No. ${data.student.scholar_number}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/students/$studentId" params={{ studentId }}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <StudentForm
        mode="edit"
        student={data.student}
        currentRecord={
          data.current
            ? {
                id: data.current.id,
                academic_session_id: data.current.academic_session_id,
                class_id: data.current.class_id,
                section_id: data.current.section_id,
                house_id: data.current.house_id,
                roll_number: data.current.roll_number,
                joined_on: data.current.joined_on,
                status: data.current.status as StudentStatus,
              }
            : null
        }
        onSaved={() => nav({ to: "/students/$studentId", params: { studentId } })}
      />
    </div>
  );
}
