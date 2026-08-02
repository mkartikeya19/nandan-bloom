import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { MigrationTabs } from "@/components/migration/migration-tabs";
import { MigrationProgressTable } from "@/components/migration/migration-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUserRoles } from "@/hooks/use-user-role";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/migration/")({
  component: MigrationDashboard,
  head: () => ({
    meta: [
      { title: "Data Migration — Nandan Kids ERP" },
      {
        name: "description",
        content:
          "Track migration progress for masters, students, teachers and opening balances before go-live.",
      },
      { property: "og:title", content: "Data Migration — Nandan Kids ERP" },
      {
        property: "og:description",
        content: "Guided, validated onboarding of an existing school into the ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ORDER = [
  "Academic Sessions",
  "Classes",
  "Sections",
  "Houses",
  "Fee Heads",
  "Fee Structures",
  "Students",
  "Teachers",
  "Opening Balances",
  "Generate Fee Schedules",
  "Go-Live Validation",
];

function MigrationDashboard() {
  const { isAdmin, isLoading } = useUserRoles();

  if (!isLoading && !isAdmin) {
    return (
      <div>
        <PageHeader
          title="Data Migration"
          description="You do not have permission to run data migration."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Data Migration"
        description="Onboard an existing school safely: import masters, students, teachers and opening balances, then validate before go-live."
      />
      <MigrationTabs />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MigrationProgressTable />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recommended import order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="list-decimal pl-5 text-sm space-y-1">
              {ORDER.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="pt-2 flex flex-col gap-2">
              <Button asChild size="sm">
                <Link to="/migration/students">
                  Start Student Migration <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/migration/go-live">Run Go-Live Validation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
