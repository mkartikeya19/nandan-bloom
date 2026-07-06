import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Wallet, CalendarCheck, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — School ERP" }] }),
});

const reports = [
  { title: "Enrolment report", desc: "Class-wise & category-wise student counts.", icon: Users },
  { title: "Fee collection", desc: "Daily, monthly and term-wise fee collection.", icon: Wallet },
  { title: "Attendance summary", desc: "Student and class attendance percentages.", icon: CalendarCheck },
  { title: "Exam performance", desc: "Subject-wise averages, toppers and pass %.", icon: ClipboardList },
  { title: "Fee dues", desc: "Outstanding fee list per student.", icon: BarChart3 },
  { title: "Teacher workload", desc: "Class assignment and workload distribution.", icon: BarChart3 },
];

function ReportsPage() {
  return (
    <div>
      <PageHeader title="Reports" description="Generate reports required by school administration and board." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.title} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <r.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{r.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
