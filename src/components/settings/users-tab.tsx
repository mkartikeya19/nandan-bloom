import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, Pencil, Loader2, ShieldCheck } from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";

type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null };
type RoleRow = { user_id: string; role: "super_admin" | "admin" | "teacher" | "staff" };
const ALL_ROLES: RoleRow["role"][] = ["super_admin", "admin", "teacher", "staff"];

export function UsersTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<RoleRow["role"]>>(new Set());

  const profilesQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email,phone").order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const rolesQ = useQuery({
    queryKey: ["user_roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const rolesByUser = useMemo(() => {
    const m: Record<string, RoleRow["role"][]> = {};
    for (const r of rolesQ.data ?? []) (m[r.user_id] ??= []).push(r.role);
    return m;
  }, [rolesQ.data]);

  const openEdit = (u: Profile) => {
    setEditingUser(u);
    setSelectedRoles(new Set(rolesByUser[u.id] ?? []));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const existing = new Set(rolesByUser[editingUser.id] ?? []);
      const toAdd = [...selectedRoles].filter((r) => !existing.has(r));
      const toRemove = [...existing].filter((r) => !selectedRoles.has(r));
      if (toAdd.length) {
        const { error } = await supabase.from("user_roles").insert(toAdd.map((role) => ({ user_id: editingUser.id, role })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", editingUser.id).in("role", toRemove);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Roles updated");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["user_roles-all"] });
      qc.invalidateQueries({ queryKey: ["current-user-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (profilesQ.data ?? []).filter((u) => {
    const q = search.toLowerCase();
    return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  const isLoading = profilesQ.isLoading || rolesQ.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User management</CardTitle>
        <CardDescription>Assign roles to users who have signed in. New users must sign up first via the login page.</CardDescription>
      </CardHeader>
      <CardContent>
        {!canEdit && <ReadOnlyNotice />}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search users by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  {canEdit && <TableHead className="w-[110px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 4 : 3} className="text-center text-sm text-muted-foreground py-8">No users found</TableCell></TableRow>
                ) : filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rolesByUser[u.id] ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        ) : (rolesByUser[u.id] ?? []).map((r) => (
                          <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="capitalize gap-1">
                            {r === "super_admin" && <ShieldCheck className="h-3 w-3" />}
                            {r.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>{editingUser?.full_name || editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                <Checkbox
                  checked={selectedRoles.has(role)}
                  onCheckedChange={(v) => {
                    const next = new Set(selectedRoles);
                    if (v) next.add(role); else next.delete(role);
                    setSelectedRoles(next);
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">{role.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {role === "super_admin" && "Full access to settings and user management."}
                    {role === "admin" && "Manage students, fees, attendance and reports."}
                    {role === "teacher" && "Class-level operations."}
                    {role === "staff" && "View-only staff access."}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
