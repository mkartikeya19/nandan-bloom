import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { MigrationTabs } from "@/components/migration/migration-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { runGoLiveValidation, type GoLiveResult } from "@/services/migration.service";
import { useUserRoles } from "@/hooks/use-user-role";
import { formatDateTime } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/migration/go-live")({
  component: GoLivePage,
  head: () => ({
    meta: [
      { title: "Go-Live Validation — Nandan Kids ERP" },
      {
        name: "description",
        content:
          "One-click validation that confirms every active student has an academic record, a complete fee structure and a generated fee schedule.",
      },
      { property: "og:title", content: "Go-Live Validation — Nandan Kids ERP" },
      {
        property: "og:description",
        content: "READY / NOT READY report with detailed issues before going live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function GoLivePage() {
  const { isAdmin, isLoading } = useUserRoles();
  const [result, setResult] = useState<GoLiveResult | null>(null);

  const run = useMutation({
    mutationFn: runGoLiveValidation,
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isLoading && !isAdmin) {
    return (
      <div>
        <PageHeader
          title="Go-Live Validation"
          description="You do not have permission to run go-live validation."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Go-Live Validation"
        description="Run every readiness check in one click. Fix each reported issue before starting live operations."
        actions={
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Run validation
          </Button>
        }
      />
      <MigrationTabs />

      {!result && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No validation has been run yet. Click <strong>Run validation</strong> to generate the
            readiness report.
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                Readiness report
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {formatDateTime(result.generated_at)} · {result.active_students} active student(s)
                </span>
              </span>
              {result.ready ? (
                <Badge className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> READY FOR GO LIVE
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> NOT READY — {result.failures} issue(s)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.checks.map((c) => (
              <div
                key={c.key}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm">{c.label}</span>
                </div>
                <span className="text-xs text-muted-foreground text-right">{c.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
