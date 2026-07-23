import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Users, GraduationCap, Wallet, CalendarCheck, ClipboardList, TrendingUp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — School ERP" }] }),
});

function ClaimAdminBanner() {
  const qc = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const { data: myRoles } = useQuery({
    enabled: !!user,
    queryKey: ["my-roles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
  if (!user || (myRoles && myRoles.length > 0)) return null;

  const claim = async () => {
    const { data, error } = await supabase.rpc("claim_first_admin");
    if (error) return toast.error(error.message);
    if (data === true) {
      toast.success("You are now the school administrator.");
      qc.invalidateQueries();
    } else {
      toast.error("An administrator already exists. Ask them to grant you a role.");
    }
  };

  return (
    <Card className="mb-6 border-primary/40 bg-primary/5">
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Finish setting up your school</p>
            <p className="text-sm text-muted-foreground">
              You don't have a role yet. If you are the first user, claim the administrator role now.
            </p>
          </div>
        </div>
        <Button onClick={claim}>Claim admin role</Button>
      </CardContent>
    </Card>
  );
}

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

function useCount(table: "students" | "teachers" | "admissions" | "fee_payments" | "attendance", filter?: { column: string; value: string }) {
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
  const teachers = useCount("teachers", { column: "status", value: "active" });

  const activeStudents = useQuery({
    queryKey: ["students-active"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .neq("status", "Left");
      if (error) throw error;
      return count ?? 0;
    },
  });
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
      <ClaimAdminBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Active Students" value={activeStudents.data ?? "—"} icon={Users} />
        <StatCard label="Teachers on staff" value={teachers.data ?? "—"} icon={GraduationCap} />
        <StatCard label="Present today" value={presentToday.data ?? "—"} icon={CalendarCheck} hint={today} />
        <StatCard label="Scheduled exams" value="—" icon={ClipboardList} hint="Coming soon" />
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
