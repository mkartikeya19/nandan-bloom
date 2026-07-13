import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fees/collect")({
  component: CollectSearch,
});

function CollectSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["fee-collect-search", q],
    enabled: q.trim().length > 0,
    queryFn: async () => {
      const term = q.trim();
      const { data, error } = await supabase
        .from("students")
        .select("id, scholar_number, full_name, father_name, student_academic_records(academic_session_id, class_id, section_id, school_classes(name), school_sections(name), academic_sessions(name), status)")
        .or(`scholar_number.ilike.%${term}%,full_name.ilike.%${term}%`)
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="Collect Fee" description="Search a student by scholar number or name." />
      <FeesTabs />
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus className="pl-10 h-12 text-base" placeholder="Type scholar number or student name..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scholar #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Father</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Session</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!q.trim() ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Start typing to search.</TableCell></TableRow>
              ) : results.isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Searching…</TableCell></TableRow>
              ) : !results.data?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students found.</TableCell></TableRow>
              ) : results.data.map((s) => {
                const active = s.student_academic_records?.find((r) => r.status === "Active") ?? s.student_academic_records?.[0];
                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => nav({ to: "/fees/collect/$studentId", params: { studentId: s.id } })}>
                    <TableCell className="font-mono">{s.scholar_number}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>{s.father_name ?? "—"}</TableCell>
                    <TableCell>{active?.school_classes?.name ?? "—"}</TableCell>
                    <TableCell>{active?.school_sections?.name ?? "—"}</TableCell>
                    <TableCell>{active?.academic_sessions?.name ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
