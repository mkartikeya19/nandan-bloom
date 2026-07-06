import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/examinations")({
  component: ExamsPage,
  head: () => ({ meta: [{ title: "Examinations — School ERP" }] }),
});

function ExamsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader
        title="Examinations"
        description="Schedule exams and record results across classes and subjects."
        actions={<Button><Plus className="h-4 w-4" /> Schedule exam</Button>}
      />

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No examinations scheduled"
          description="Create unit tests, half-yearly, annual or board-style examinations here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((e) => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{e.name}</CardTitle>
                  <Badge variant="secondary" className="capitalize">{e.exam_type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Class</span><span>{e.class_name ?? "All"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Year</span><span>{e.academic_year}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{e.start_date ? new Date(e.start_date).toLocaleDateString("en-IN") : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{e.end_date ? new Date(e.end_date).toLocaleDateString("en-IN") : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max marks</span><span>{e.max_marks ?? "—"}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
