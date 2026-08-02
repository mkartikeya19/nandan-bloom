import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { MigrationTabs } from "@/components/migration/migration-tabs";
import { ExcelImport } from "@/components/students/excel-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserRoles } from "@/hooks/use-user-role";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/migration/students")({
  component: StudentMigrationWizard,
  head: () => ({
    meta: [
      { title: "Student Migration Wizard — Nandan Kids ERP" },
      {
        name: "description",
        content:
          "Validate, preview and commit an Excel import of existing students, with academic records and fee schedules generated automatically.",
      },
      { property: "og:title", content: "Student Migration Wizard — Nandan Kids ERP" },
      {
        property: "og:description",
        content: "Guided student import with a downloadable validation error report.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StudentMigrationWizard() {
  const { isAdmin, isLoading } = useUserRoles();

  if (!isLoading && !isAdmin) {
    return (
      <div>
        <PageHeader
          title="Student Migration"
          description="You do not have permission to run data migration."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Student Migration Wizard"
        description="Download the template, upload your file, fix validation errors, then commit. Academic records and the current fee schedule are generated automatically for every imported student."
      />
      <MigrationTabs />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">How this wizard works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Step 1</strong> — Download the template and fill in your student data.
          </p>
          <p>
            <strong>Step 2</strong> — Upload and validate. Invalid rows are listed and can be
            exported as an error report.
          </p>
          <p>
            <strong>Step 3</strong> — Commit the valid rows. Each student gets a personal record, an
            academic record for the chosen session/class/section, and a generated fee schedule from
            the matching Complete Fee Structure.
          </p>
          <p>
            <strong>Step 4</strong> — Import opening balances, then run Go-Live Validation.
          </p>
        </CardContent>
      </Card>

      <ExcelImport batchType="students" />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/fees/import">
            Next: Opening Balances <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/migration/go-live">Go-Live Validation</Link>
        </Button>
      </div>
    </div>
  );
}
