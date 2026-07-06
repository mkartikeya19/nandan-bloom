import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Users, UserPlus, GraduationCap, Wallet, CalendarCheck, ClipboardList, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — School ERP" }] }),
});

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function useCount(table: "students" | "teachers" | "admissions" | "fee_payments" | "attendance" | "exams", filter?: { column: string; value: string }) {
  return useQuery({
    queryKey: ["count", table, filter],
    queryFn: async () => {
      let q = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) q = q.eq(filter.column, filter.value);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Dashboard() {
  const students = useCount("students", { column: "status", value: "active" });
  const teachers = useCount("teachers", { column: "status", value: "active" });
  const admissions = useCount("admissions", { column: "status", value: "pending" });
  const exams = useCount("exams");
  const today = new Date().toISOString().slice(0, 10);
  const presentToday = useQuery({
    queryKey: ["attendance-today", today],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("date", today)
        .eq("status", "present");
      if (error) throw error;
      return count ?? 0;
    },
  });
  const feesThisMonth = useQuery({
    queryKey: ["fees-month"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      const { data, error } = await supabase
        .from("fee_payments")
        .select("amount")
        .gte("payment_date", start.toISOString().slice(0, 10));
      if (error) throw error;
      return (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
    },
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of the school's key metrics for the current academic session."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Active Students" value={students.data ?? "—"} icon={Users} />
        <StatCard label="Teachers on staff" value={teachers.data ?? "—"} icon={GraduationCap} />
        <StatCard label="Pending admissions" value={admissions.data ?? "—"} icon={UserPlus} />
        <StatCard label="Present today" value={presentToday.data ?? "—"} icon={CalendarCheck} hint={today} />
        <StatCard label="Scheduled exams" value={exams.data ?? "—"} icon={ClipboardList} />
        <StatCard
          label="Fees collected (month)"
          value={feesThisMonth.data != null ? `₹${feesThisMonth.data.toLocaleString("en-IN")}` : "—"}
          icon={Wallet}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Activity will appear here as staff record admissions, attendance,
              fee payments and exam results.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• Start by adding classes and teachers in Settings.</p>
            <p>• Use Admissions to intake new applications.</p>
            <p>• Configure fee structures before recording payments.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
