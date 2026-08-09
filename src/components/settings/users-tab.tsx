import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Pencil,
  Loader2,
  ShieldCheck,
  UserPlus,
  Ban,
  Copy,
  UserX,
  UserCheck,
  Trash2,
} from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";
import { APP_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { fetchAllUserRoles, fetchProfiles, type ProfileRow } from "@/services/users.service";
import {
  fetchInvitations,
  invitationStatus,
  revokeInvitation,
} from "@/services/invitations.service";
import { inviteUser } from "@/lib/invitations.functions";
import {
  checkUserDeletable,
  deleteUser,
  setUserActive,
  setUserRoles,
  type DeleteEligibility,
} from "@/lib/user-lifecycle.functions";
import { useUserRoles } from "@/hooks/use-user-role";
import {
  canAttemptDelete,
  canDeactivate,
  canRemoveSuperAdmin,
  countActiveSuperAdmins,
  type LifecycleUser,
} from "@/lib/user-lifecycle";
import { formatDate } from "@/lib/date";

export function UsersTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const invite = useServerFn(inviteUser);
  const saveRoles = useServerFn(setUserRoles);
  const toggleActive = useServerFn(setUserActive);
  const checkDeletable = useServerFn(checkUserDeletable);
  const hardDelete = useServerFn(deleteUser);
  const { userId: currentUserId } = useUserRoles();

  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<AppRole>>(new Set());

  const [statusUser, setStatusUser] = useState<ProfileRow | null>(null);
  const [statusReason, setStatusReason] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [eligibility, setEligibility] = useState<DeleteEligibility | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRoles, setInviteRoles] = useState<Set<AppRole>>(new Set(["staff"]));
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const profilesQ = useQuery({ queryKey: ["profiles-all"], queryFn: fetchProfiles });
  const rolesQ = useQuery({ queryKey: ["user_roles-all"], queryFn: fetchAllUserRoles });
  const invitesQ = useQuery({
    queryKey: ["user-invitations"],
    queryFn: fetchInvitations,
    enabled: canEdit,
  });

  const rolesByUser = useMemo(() => {
    const m: Record<string, AppRole[]> = {};
    for (const r of rolesQ.data ?? []) (m[r.user_id] ??= []).push(r.role);
    return m;
  }, [rolesQ.data]);

  const lifecycleUsers = useMemo<LifecycleUser[]>(
    () =>
      (profilesQ.data ?? []).map((p) => ({
        id: p.id,
        isActive: p.is_active,
        roles: rolesByUser[p.id] ?? [],
      })),
    [profilesQ.data, rolesByUser],
  );
  const activeSuperAdmins = useMemo(() => countActiveSuperAdmins(lifecycleUsers), [lifecycleUsers]);
  const asLifecycle = (u: ProfileRow): LifecycleUser => ({
    id: u.id,
    isActive: u.is_active,
    roles: rolesByUser[u.id] ?? [],
  });

  const refreshUsers = () => {
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
    qc.invalidateQueries({ queryKey: ["user_roles-all"] });
    qc.invalidateQueries({ queryKey: ["current-user-roles"] });
    qc.invalidateQueries({ queryKey: ["activity-log"] });
  };

  const openEdit = (u: ProfileRow) => {
    setEditingUser(u);
    setSelectedRoles(new Set(rolesByUser[u.id] ?? []));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      await saveRoles({ data: { userId: editingUser.id, roles: [...selectedRoles] } });
    },
    onSuccess: () => {
      toast.success("Roles updated");
      setEditingUser(null);
      refreshUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ user, active }: { user: ProfileRow; active: boolean }) =>
      toggleActive({
        data: { userId: user.id, active, reason: statusReason.trim() || undefined },
      }),
    onSuccess: (_res, vars) => {
      toast.success(vars.active ? "Account reactivated" : "Account deactivated");
      setStatusUser(null);
      setStatusReason("");
      refreshUsers();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDelete = useMutation({
    mutationFn: async (user: ProfileRow) => {
      setDeleteTarget(user);
      setEligibility(null);
      return checkDeletable({ data: { userId: user.id } });
    },
    onSuccess: (res) => setEligibility(res),
    onError: (e: Error) => {
      setDeleteTarget(null);
      toast.error(e.message);
    },
  });

  const confirmDelete = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      await hardDelete({ data: { userId: deleteTarget.id } });
    },
    onSuccess: () => {
      toast.success("Account permanently deleted");
      setDeleteTarget(null);
      setEligibility(null);
      refreshUsers();
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
      refreshUsers();
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
    return (
      (u.full_name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q)
    );
  });

  const isLoading = profilesQ.isLoading || rolesQ.isLoading;

  // Mirrors the database guards so the UI never offers a call that must fail.
  const isSelf = (u: ProfileRow) => u.id === currentUserId;
  const mayDeactivate = (u: ProfileRow) =>
    canDeactivate(asLifecycle(u), currentUserId, activeSuperAdmins);
  const maySwapSuperAdmin = (u: ProfileRow) =>
    canRemoveSuperAdmin(asLifecycle(u), currentUserId, activeSuperAdmins);
  const mayDelete = (u: ProfileRow) => canAttemptDelete(asLifecycle(u), currentUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>User management</CardTitle>
            <CardDescription>
              Public sign-up is disabled. Staff accounts are created here by invitation only.
              Deactivated accounts lose all access immediately and keep their history.
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setTempPassword(null);
                setInviteOpen(true);
              }}
              className="gap-2 shrink-0"
            >
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!canEdit && <ReadOnlyNotice />}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="w-[190px] text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canEdit ? 5 : 4}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((u) => (
                      <TableRow key={u.id} className={u.is_active ? undefined : "opacity-70"}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>{u.email ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(rolesByUser[u.id] ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">No roles</span>
                            ) : (
                              (rolesByUser[u.id] ?? []).map((r) => (
                                <Badge
                                  key={r}
                                  variant={r === "super_admin" ? "default" : "secondary"}
                                  className="gap-1"
                                >
                                  {r === "super_admin" && <ShieldCheck className="h-3 w-3" />}
                                  {ROLE_LABELS[r]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.is_active ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="outline">Deactivated</Badge>
                              {u.deactivated_at && (
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(u.deactivated_at)}
                                  {u.deactivation_reason ? ` — ${u.deactivation_reason}` : ""}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Edit roles"
                                onClick={() => openEdit(u)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title={
                                  !u.is_active
                                    ? "Reactivate"
                                    : isSelf(u)
                                      ? "You cannot deactivate your own account"
                                      : !mayDeactivate(u)
                                        ? "At least one active Super Admin must remain"
                                        : "Deactivate"
                                }
                                disabled={u.is_active && !mayDeactivate(u)}
                                onClick={() => {
                                  setStatusReason("");
                                  setStatusUser(u);
                                }}
                              >
                                {u.is_active ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Delete permanently"
                                disabled={!mayDelete(u) || openDelete.isPending}
                                onClick={() => openDelete.mutate(u)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
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
            {invitesQ.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
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
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-8"
                        >
                          No invitations yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      (invitesQ.data ?? []).map((inv) => {
                        const status = invitationStatus(inv);
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.email}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {inv.roles.map((r) => (
                                  <Badge key={r} variant="secondary">
                                    {ROLE_LABELS[r] ?? r}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(inv.created_at)}</TableCell>
                            <TableCell>{formatDate(inv.expires_at)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  status === "Accepted"
                                    ? "default"
                                    : status === "Pending"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {status === "Pending" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1"
                                  onClick={() => revoke.mutate(inv.id)}
                                  disabled={revoke.isPending}
                                >
                                  <Ban className="h-3.5 w-3.5" /> Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deactivate / reactivate dialog */}
      <Dialog open={!!statusUser} onOpenChange={(o) => !o && setStatusUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusUser?.is_active ? "Deactivate account" : "Reactivate account"}
            </DialogTitle>
            <DialogDescription>
              {statusUser?.full_name || statusUser?.email}
              {statusUser?.is_active
                ? " will lose access immediately, including any open session. All of their history is kept."
                : " will regain access with their existing roles."}
            </DialogDescription>
          </DialogHeader>
          {statusUser?.is_active && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                maxLength={300}
                placeholder="e.g. Left the school"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusUser(null)}>
              Cancel
            </Button>
            <Button
              variant={statusUser?.is_active ? "destructive" : "default"}
              disabled={changeStatus.isPending}
              onClick={() =>
                statusUser &&
                changeStatus.mutate({ user: statusUser, active: !statusUser.is_active })
              }
            >
              {changeStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {statusUser?.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard delete dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setEligibility(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently</DialogTitle>
            <DialogDescription>{deleteTarget?.full_name || deleteTarget?.email}</DialogDescription>
          </DialogHeader>
          {openDelete.isPending || !eligibility ? (
            <Skeleton className="h-20 w-full" />
          ) : eligibility.deletable ? (
            <p className="text-sm">
              This account has no operational history. Deleting removes the login, the profile and
              all role assignments. Activity-log entries are kept for audit. This cannot be undone.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                This account cannot be deleted because it is referenced by school records.
                Deactivate it instead — access is revoked and history stays intact.
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {eligibility.blockers.map((b) => (
                  <li key={b.label}>
                    {b.label} ({b.count})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!eligibility?.deletable || confirmDelete.isPending}
              onClick={() => confirmDelete.mutate()}
            >
              {confirmDelete.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Delete
              permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o);
          if (!o) setTempPassword(null);
        }}
      >
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
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setInviteOpen(false);
                    setTempPassword(null);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teacher@school.in"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Full name (optional)</label>
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Roles</label>
                {APP_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={inviteRoles.has(role)}
                      onCheckedChange={(v) => {
                        const next = new Set(inviteRoles);
                        if (v) next.add(role);
                        else next.delete(role);
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
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => sendInvite.mutate()}
                  disabled={sendInvite.isPending || !inviteEmail.trim() || inviteRoles.size === 0}
                >
                  {sendInvite.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send
                  invitation
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
            {APP_ROLES.map((role) => {
              const lockedSuperAdmin =
                role === "super_admin" &&
                !!editingUser &&
                selectedRoles.has("super_admin") &&
                !maySwapSuperAdmin(editingUser);
              return (
                <label
                  key={role}
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedRoles.has(role)}
                    disabled={lockedSuperAdmin}
                    onCheckedChange={(v) => {
                      const next = new Set(selectedRoles);
                      if (v) next.add(role);
                      else next.delete(role);
                      setSelectedRoles(next);
                    }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-muted-foreground">
                      {lockedSuperAdmin
                        ? "You cannot remove your own Super Admin role, and at least one active Super Admin must remain."
                        : ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
