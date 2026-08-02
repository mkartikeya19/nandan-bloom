import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { MigrationTabs } from "@/components/migration/migration-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/date";
import {
  fetchMigrationBatches,
  rollbackMigrationBatch,
  type MigrationBatch,
} from "@/services/migration.service";
import { useUserRoles } from "@/hooks/use-user-role";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/migration/batches")({
  component: BatchesPage,
  head: () => ({
    meta: [
      { title: "Migration Batches — Nandan Kids ERP" },
      {
        name: "description",
        content:
          "Every bulk import is tracked as a migration batch and the most recent one can be rolled back if no operational transactions followed it.",
      },
      { property: "og:title", content: "Migration Batches — Nandan Kids ERP" },
      {
        property: "og:description",
        content: "Audit and roll back migration batches safely.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TYPE_LABELS: Record<string, string> = {
  students: "Students",
  opening_balances: "Opening Balances",
  teachers: "Teachers",
};

function BatchesPage() {
  const qc = useQueryClient();
  const { isAdmin, isLoading } = useUserRoles();

  const { data: batches } = useQuery({
    queryKey: ["migration-batches"],
    queryFn: fetchMigrationBatches,
    enabled: isAdmin,
  });

  const rollback = useMutation({
    mutationFn: rollbackMigrationBatch,
    onSuccess: (_d, batchId) => {
      toast.success("Migration batch rolled back");
      void logActivity({
        module: "Settings",
        action: "Rolled back migration batch",
        entityType: "migration_batch",
        entityId: batchId,
      });
      qc.invalidateQueries({ queryKey: ["migration-batches"] });
      qc.invalidateQueries({ queryKey: ["migration-progress"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isLoading && !isAdmin) {
    return (
      <div>
        <PageHeader
          title="Migration Batches"
          description="You do not have permission to view migration batches."
        />
      </div>
    );
  }

  const list: MigrationBatch[] = batches ?? [];
  const latestActive = list.find((b) => !b.rolled_back_at);

  return (
    <div>
      <PageHeader
        title="Migration Batches"
        description="Each bulk import is recorded as a batch. Only the most recent batch can be rolled back, and only when no fee collections, admissions or promotions happened afterwards."
      />
      <MigrationTabs />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent batches</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Label</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No migration batches recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {list.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{formatDateTime(b.created_at)}</TableCell>
                  <TableCell>{TYPE_LABELS[b.batch_type] ?? b.batch_type}</TableCell>
                  <TableCell className="text-sm">{b.label ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.record_count}</TableCell>
                  <TableCell>
                    {b.rolled_back_at ? (
                      <Badge variant="secondary">Rolled back</Badge>
                    ) : (
                      <Badge>Applied</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!b.rolled_back_at && latestActive?.id === b.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={rollback.isPending}>
                            <Undo2 className="h-4 w-4" /> Rollback
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Roll back this migration batch?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the {b.record_count} record(s) created by
                              this import, including their academic records and generated fee
                              schedules. It is blocked if any fee collection, admission or promotion
                              happened after the batch. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => rollback.mutate(b.id)}>
                              Roll back
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
