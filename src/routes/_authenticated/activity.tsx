import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";
import { formatActivityDetails } from "@/lib/activity-format";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityCenter,
  head: () => ({ meta: [{ title: "Activity Center — School ERP" }] }),
});

interface ActivityRow {
  id: string;
  user_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

function ActivityCenter() {
  const perms = useUserRoles();
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["activity-log", moduleFilter],
    queryFn: async () => {
      let query = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (moduleFilter !== "all") query = query.eq("module", moduleFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const userIds = useMemo(() => Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[])), [rows]);
  const { data: profiles } = useQuery({
    enabled: userIds.length > 0,
    queryKey: ["activity-profiles", userIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: roles } = useQuery({
    enabled: userIds.length > 0,
    queryKey: ["activity-roles", userIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, { name: string; email: string; roles: string[] }>();
    (profiles ?? []).forEach((p) => m.set(p.id, { name: p.full_name ?? p.email ?? "—", email: p.email ?? "", roles: [] }));
    (roles ?? []).forEach((r) => {
      const p = m.get(r.user_id);
      if (p) p.roles.push(r.role as string);
    });
    return m;
  }, [profiles, roles]);

  const filtered = (rows ?? []).filter((r) => {
    if (!q) return true;
    const p = r.user_id ? profileMap.get(r.user_id) : null;
    const hay = [r.module, r.action, r.entity_type, p?.name, p?.email].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const exportCsv = () => {
    const header = ["Date", "Time", "User", "Role", "Module", "Action", "Entity", "Details"];
    const csv = [header.join(",")].concat(
      filtered.map((r) => {
        const p = r.user_id ? profileMap.get(r.user_id) : null;
        const d = new Date(r.created_at);
        const details = JSON.stringify(r.details ?? {}).replace(/"/g, '""');
        return [
          d.toLocaleDateString("en-IN"),
          d.toLocaleTimeString("en-IN"),
          p?.name ?? "System",
          p?.roles.join("|") ?? "",
          r.module,
          r.action,
          `${r.entity_type ?? ""}:${r.entity_id ?? ""}`,
          `"${details}"`,
        ].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",");
      }),
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modules = ["Students", "Admissions", "Fees", "Attendance", "Examinations", "Users", "Sessions", "Settings", "Promotion"];
  const canSeeAll = perms.isAdmin || perms.isSuperAdmin || perms.isPrincipal;

  return (
    <div>
      <PageHeader
        title="Activity Center"
        description={canSeeAll ? "Audit log of all important actions across the ERP." : "Audit log of your own actions."}
        actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
      />
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search action, user, module…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="border rounded-md px-3 py-2 bg-background" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
            <option value="all">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No activity recorded yet.</TableCell></TableRow>
              ) : filtered.map((r) => {
                const p = r.user_id ? profileMap.get(r.user_id) : null;
                const d = new Date(r.created_at);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{d.toLocaleDateString("en-IN")} {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>{p?.name ?? "System"}</TableCell>
                    <TableCell className="text-xs">{p?.roles.join(", ") ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{r.module}</Badge></TableCell>
                    <TableCell className="font-medium">{r.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[360px]" title={JSON.stringify(r.details ?? {})}>{formatActivityDetails(r.module, r.action, r.details)}</TableCell>
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
