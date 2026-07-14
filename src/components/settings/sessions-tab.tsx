import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";

import { useUserRoles } from "@/hooks/use-user-role";
type Session = { id: string; name: string; start_date: string; end_date: string; is_active: boolean; status: "Draft" | "Active" | "Closed"; closed_at: string | null };

export function SessionsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const perms = useUserRoles();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", is_active: false });

  const { data, isLoading } = useQuery({
    queryKey: ["academic_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const openNew = () => { setEditing(null); setForm({ name: "", start_date: "", end_date: "", is_active: false }); setOpen(true); };
  const openEdit = (s: Session) => { setEditing(s); setForm({ name: s.name, start_date: s.start_date, end_date: s.end_date, is_active: s.is_active }); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      if (!form.start_date || !form.end_date) throw new Error("Start and end dates are required");
      if (form.end_date <= form.start_date) throw new Error("End date must be after start date");

      // If activating, deactivate others first
      if (form.is_active) {
        const q = supabase.from("academic_sessions").update({ is_active: false }).eq("is_active", true);
        if (editing) await q.neq("id", editing.id); else await q;
      }

      if (editing) {
        const { error } = await supabase.from("academic_sessions").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_sessions").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Session updated" : "Session created"); setOpen(false); qc.invalidateQueries({ queryKey: ["academic_sessions"] }); },
    onError: (e: Error) => {
      if (e.message.includes("duplicate")) toast.error("A session with that name already exists");
      else if (e.message.includes("academic_sessions_one_active")) toast.error("Only one session can be active at a time");
      else toast.error(e.message);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("academic_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session deleted"); qc.invalidateQueries({ queryKey: ["academic_sessions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Academic sessions</CardTitle>
          <CardDescription>Only one session can be active at a time.</CardDescription>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> New session</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit session" : "New session"}</DialogTitle>
                <DialogDescription>e.g. 2025-2026</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2025-2026" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Start date *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>End date *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div><Label>Active session</Label><p className="text-xs text-muted-foreground">Deactivates any other active session.</p></div>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!canEdit && <ReadOnlyNotice />}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search sessions..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-[110px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center text-sm text-muted-foreground py-8">No sessions found</TableCell></TableRow>
                ) : filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.start_date}</TableCell>
                    <TableCell>{s.end_date}</TableCell>
                    <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete session "{s.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>This will also delete all classes and sections under this session. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(s.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
  );
}
