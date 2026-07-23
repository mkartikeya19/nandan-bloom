import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Layers, GraduationCap, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/examinations")({
  component: ExamsHome,
  head: () => ({
    meta: [
      { title: "Examinations — Nandan Kids ERP" },
      { name: "description", content: "Configure examination patterns, subjects, assessment components and grade scales." },
    ],
  }),
});

function ExamsHome() {
  return (
    <div>
      <PageHeader
        title="Examinations"
        description="Configure the examination system. Phase 1 sets up masters — patterns, subjects and grade scales."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MasterCard to="/examinations/subjects" icon={BookOpen} title="Subjects" description="Global subject list and class-wise mapping with assessment components." />
        <MasterCard to="/examinations/patterns" icon={Layers} title="Exam Patterns" description="Versioned exam schemes per session. Clone across sessions, immutable once used." />
        <MasterCard to="/examinations/grade-scales" icon={Award} title="Grade Scales" description="Reusable grading bands (A+/A/B…) with percent ranges." />
        <Card className="opacity-60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" /> Marks Entry</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Available in Phase 2. Requires patterns and class subjects configured.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MasterCard({ to, icon: Icon, title, description }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild size="sm" variant="outline"><Link to={to}>Open</Link></Button>
      </CardContent>
    </Card>
  );
}
