import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ExcelImport } from "@/components/students/excel-import";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/students/import")({
  component: ImportPage,
  head: () => ({ meta: [{ title: "Import Students — School ERP" }] }),
});

function ImportPage() {
  const perms = useUserRoles();
  if (!perms.isLoading && !perms.canCreateStudent) {
    return (
      <div>
        <PageHeader
          title="Import Students"
          description="You do not have permission to import students."
        />
        <Button asChild variant="outline">
          <Link to="/students">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        title="Import Students"
        description="Bulk-import existing students from an Excel file. Invalid rows are skipped."
        actions={
          <Button variant="outline" asChild>
            <Link to="/students">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />
      <ExcelImport />
    </div>
  );
}
