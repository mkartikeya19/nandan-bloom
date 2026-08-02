import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";

type Klass = { id: string; session_id: string; name: string; order_index: number };
type Session = { id: string; name: string; is_active: boolean };

export function ClassesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Klass | null>(null);
  const [form, setForm] = useState({ session_id: "", name: "", order_index: 0 });

  const sessionsQ = useQuery({
    queryKey: ["academic_sessions", "for-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("id,name,is_active")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });

  const classesQ = useQuery({
    queryKey: ["school_classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_classes")
        .select("*")
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as Klass[];
    },
  });

  const sessionsById = useMemo(
    () => Object.fromEntries((sessionsQ.data ?? []).map((s) => [s.id, s])),
    [sessionsQ.data],
  );

  const openNew = () => {
    const activeSession = sessionsQ.data?.find((s) => s.is_active) ?? sessionsQ.data?.[0];
    setEditing(null);
    setForm({ session_id: activeSession?.id ?? "", name: "", order_index: 0 });
    setOpen(true);
  };
  const openEdit = (k: Klass) => {
    setEditing(k);
    setForm({ session_id: k.session_id, name: k.name, order_index: k.order_index });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.session_id) throw new Error("Please select a session");
      if (!form.name.trim()) throw new Error("Class name is required");
      if (editing) {
        const { error } = await supabase.from("school_classes").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_classes").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Class updated" : "Class created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["school_classes"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate")
          ? "A class with that name already exists in this session"
          : e.message,
      ),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class deleted");
      qc.invalidateQueries({ queryKey: ["school_classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (classesQ.data ?? [])
    .filter((k) => (sessionFilter === "all" ? true : k.session_id === sessionFilter))
    .filter((k) => k.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Classes</CardTitle>
          <CardDescription>Class names are unique within a session.</CardDescription>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} disabled={!sessionsQ.data?.length}>
                <Plus className="h-4 w-4" /> New class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit class" : "New class"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Session *</Label>
                  <Select
                    value={form.session_id}
                    onValueChange={(v) => setForm({ ...form, session_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sessionsQ.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.is_active ? " (active)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Class name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Class 1, Nursery, XII-Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display order</Label>
                  <Input
                    type="number"
                    value={form.order_index}
                    onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
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
        {!sessionsQ.isLoading && !sessionsQ.data?.length && (
          <p className="mb-4 text-sm text-muted-foreground">Create an academic session first.</p>
        )}
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search classes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sessionFilter} onValueChange={setSessionFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              {(sessionsQ.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {classesQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Order</TableHead>
                  {canEdit && <TableHead className="w-[110px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canEdit ? 4 : 3}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      No classes found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell>{sessionsById[k.session_id]?.name ?? "—"}</TableCell>
                      <TableCell>{k.order_index}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(k)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete class "{k.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will also delete all sections under this class.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(k.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
  );
}
