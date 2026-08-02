import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StudentForm } from "@/components/students/student-form";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/students/new")({
  component: NewAdmissionPage,
  head: () => ({ meta: [{ title: "New Admission — School ERP" }] }),
});

function NewAdmissionPage() {
  const nav = useNavigate();
  const perms = useUserRoles();

  if (!perms.isLoading && !perms.canCreateStudent) {
    return (
      <div>
        <PageHeader
          title="New Admission"
          description="You do not have permission to create students."
        />
        <Button asChild variant="outline">
          <Link to="/students">
            <ArrowLeft className="h-4 w-4" /> Back to Students
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Admission"
        description="Create a new student profile and their first academic record."
        actions={
          <Button variant="outline" asChild>
            <Link to="/students">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <StudentForm
        mode="new"
        onSaved={(id) => nav({ to: "/students/$studentId", params: { studentId: id } })}
      />
    </div>
  );
}
