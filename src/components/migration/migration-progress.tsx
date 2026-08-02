import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, CircleDashed, Lock } from "lucide-react";
import { fetchMigrationProgress } from "@/services/migration.service";

interface Row {
  module: string;
  imported: number;
  required: boolean;
  blocked?: boolean;
}

export function MigrationProgressTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["migration-progress"],
    queryFn: fetchMigrationProgress,
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading migration progress…
        </CardContent>
      </Card>
    );
  }

  const mastersReady =
    data.sessions > 0 &&
    data.classes > 0 &&
    data.sections > 0 &&
    data.feeHeads > 0 &&
    data.feeStructures > 0;

  const rows: Row[] = [
    { module: "Academic Sessions", imported: data.sessions, required: true },
    { module: "Classes", imported: data.classes, required: true },
    { module: "Sections", imported: data.sections, required: true },
    { module: "Houses", imported: data.houses, required: false },
    { module: "Fee Heads", imported: data.feeHeads, required: true },
    { module: "Fee Structures", imported: data.feeStructures, required: true },
    { module: "Students", imported: data.students, required: true, blocked: !mastersReady },
    {
      module: "Academic Records",
      imported: data.academicRecords,
      required: true,
      blocked: !mastersReady,
    },
    {
      module: "Fee Schedules",
      imported: data.feeSchedules,
      required: true,
      blocked: data.academicRecords === 0,
    },
    { module: "Teachers", imported: data.teachers, required: false },
    {
      module: "Opening Balances",
      imported: data.openingBalances,
      required: false,
      blocked: data.students === 0,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Migration Progress</span>
          {mastersReady ? (
            <Badge className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Masters ready
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3.5 w-3.5" /> Complete masters first
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const done = r.imported > 0;
              return (
                <TableRow key={r.module}>
                  <TableCell className="font-medium">{r.module}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.imported}</TableCell>
                  <TableCell>
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> Imported
                      </span>
                    ) : r.blocked ? (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Lock className="h-4 w-4" /> Blocked — prerequisites incomplete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <CircleDashed className="h-4 w-4" />{" "}
                        {r.required ? "Pending" : "Pending (optional)"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
