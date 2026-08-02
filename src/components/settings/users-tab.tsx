import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, Pencil, Loader2, ShieldCheck, UserPlus, Ban, Copy } from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import {
  addUserRoles,
  fetchAllUserRoles,
  fetchProfiles,
  removeUserRoles,
  type ProfileRow,
} from "@/services/users.service";
import {
  fetchInvitations,
  invitationStatus,
  revokeInvitation,
} from "@/services/invitations.service";
import { inviteUser } from "@/lib/invitations.functions";
import { formatDate } from "@/lib/date";

export function UsersTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);

  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<AppRole>>(new Set());

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRoles, setInviteRoles] = useState<Set<AppRole>>(new Set(["staff"]));
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const profilesQ = useQuery({ queryKey: ["profiles-all"], queryFn: fetchProfiles });
  const rolesQ = useQuery({ queryKey: ["user_roles-all"], queryFn: fetchAllUserRoles });
  const invitesQ = useQuery({ queryKey: ["user-invitations"], queryFn: fetchInvitations, enabled: canEdit });

  const rolesByUser = useMemo(() => {
    const m: Record<string, AppRole[]> = {};
    for (const r of rolesQ.data ?? []) (m[r.user_id] ??= []).push(r.role);
    return m;
  }, [rolesQ.data]);

  const openEdit = (u: ProfileRow) => {
    setEditingUser(u);
    setSelectedRoles(new Set(rolesByUser[u.id] ?? []));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const existing = new Set(rolesByUser[editingUser.id] ?? []);
      await addUserRoles(editingUser.id, [...selectedRoles].filter((r) => !existing.has(r)));
      await removeUserRoles(editingUser.id, [...existing].filter((r) => !selectedRoles.has(r)));
    },
    onSuccess: () => {
      toast.success("Roles updated");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["user_roles-all"] });
      qc.invalidateQueries({ queryKey: ["current-user-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvite = useMutation({
    mutationFn: async () =>
      invite({
        data: {
          email: inviteEmail.trim(),
          fullName: inviteName.trim() || undefined,
          roles: [...inviteRoles],
        },
      }),
    onSuccess: (res) => {
      setTempPassword(res.tempPassword);
      toast.success(
        res.created
          ? "Invitation created and account provisioned."
          : "User already existed — invited roles were granted.",
      );
      setInviteEmail("");
      setInviteName("");
      setInviteRoles(new Set(["staff"]));
      qc.invalidateQueries({ queryKey: ["user-invitations"] });
      qc.invalidateQueries({ queryKey: ["profiles-all"] });
      qc.invalidateQueries({ queryKey: ["user_roles-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: ["user-invitations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (profilesQ.data ?? []).filter((u) => {
    const q = search.toLowerCase();
    return (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
  });

  const isLoading = profilesQ.isLoading || rolesQ.isLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>User management</CardTitle>
            <CardDescription>
              Public sign-up is disabled. Staff accounts are created here by invitation only.
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={() => { setTempPassword(null); setInviteOpen(true); }} className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          )}
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
                            <Badge key={r} variant={r === "super_admin" ? "default" : "secondary"} className="gap-1">
                              {r === "super_admin" && <ShieldCheck className="h-3 w-3" />}
                              {ROLE_LABELS[r]}
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
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>Pending, accepted and revoked staff invitations.</CardDescription>
          </CardHeader>
          <CardContent>
            {invitesQ.isLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[110px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invitesQ.data ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No invitations yet</TableCell></TableRow>
                    ) : (invitesQ.data ?? []).map((inv) => {
                      const status = invitationStatus(inv);
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {inv.roles.map((r) => <Badge key={r} variant="secondary">{ROLE_LABELS[r] ?? r}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(inv.created_at)}</TableCell>
                          <TableCell>{formatDate(inv.expires_at)}</TableCell>
                          <TableCell>
                            <Badge variant={status === "Accepted" ? "default" : status === "Pending" ? "secondary" : "outline"}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {status === "Pending" && (
                              <Button size="sm" variant="ghost" className="gap-1" onClick={() => revoke.mutate(inv.id)} disabled={revoke.isPending}>
                                <Ban className="h-3.5 w-3.5" /> Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) setTempPassword(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite a staff member</DialogTitle>
            <DialogDescription>
              Creates the account and grants the selected roles the first time they sign in.
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-3">
              <p className="text-sm">
                Account created. Share this one-time password securely — it is shown only now and
                should be changed after first sign-in.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={tempPassword} className="font-mono" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copied"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteOpen(false); setTempPassword(null); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teacher@school.in" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name (optional)</label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. Priya Sharma" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roles</label>
                {APP_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer">
                    <Checkbox
                      checked={inviteRoles.has(role)}
                      onCheckedChange={(v) => {
                        const next = new Set(inviteRoles);
                        if (v) next.add(role); else next.delete(role);
                        setInviteRoles(next);
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                    </div>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => sendInvite.mutate()}
                  disabled={sendInvite.isPending || !inviteEmail.trim() || inviteRoles.size === 0}
                >
                  {sendInvite.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send invitation
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit roles dialog */}
      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit roles</DialogTitle>
            <DialogDescription>{editingUser?.full_name || editingUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {APP_ROLES.map((role) => (
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
                  <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
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
    </div>
  );
}
