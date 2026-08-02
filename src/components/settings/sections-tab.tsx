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

type Section = { id: string; class_id: string; name: string };
type Klass = { id: string; name: string; session_id: string };
type Session = { id: string; name: string };

export function SectionsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState({ class_id: "", name: "" });

  const classesQ = useQuery({
    queryKey: ["school_classes", "for-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_classes")
        .select("id,name,session_id")
        .order("order_index");
      if (error) throw error;
      return (data ?? []) as Klass[];
    },
  });
  const sessionsQ = useQuery({
    queryKey: ["academic_sessions", "for-sections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("id,name");
      if (error) throw error;
      return (data ?? []) as Session[];
    },
  });
  const sectionsQ = useQuery({
    queryKey: ["school_sections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_sections").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Section[];
    },
  });

  const classesById = useMemo(
    () => Object.fromEntries((classesQ.data ?? []).map((c) => [c.id, c])),
    [classesQ.data],
  );
  const sessionsById = useMemo(
    () => Object.fromEntries((sessionsQ.data ?? []).map((s) => [s.id, s])),
    [sessionsQ.data],
  );

  const openNew = () => {
    setEditing(null);
    setForm({ class_id: classesQ.data?.[0]?.id ?? "", name: "" });
    setOpen(true);
  };
  const openEdit = (s: Section) => {
    setEditing(s);
    setForm({ class_id: s.class_id, name: s.name });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.class_id) throw new Error("Please select a class");
      if (!form.name.trim()) throw new Error("Section name is required");
      if (editing) {
        const { error } = await supabase.from("school_sections").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_sections").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Section updated" : "Section created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["school_sections"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate")
          ? "A section with that name already exists in this class"
          : e.message,
      ),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("school_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section deleted");
      qc.invalidateQueries({ queryKey: ["school_sections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (sectionsQ.data ?? [])
    .filter((s) => (classFilter === "all" ? true : s.class_id === classFilter))
    .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Sections</CardTitle>
          <CardDescription>Section names are unique within a class.</CardDescription>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} disabled={!classesQ.data?.length}>
                <Plus className="h-4 w-4" /> New section
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit section" : "New section"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Class *</Label>
                  <Select
                    value={form.class_id}
                    onValueChange={(v) => setForm({ ...form, class_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classesQ.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {sessionsById[c.session_id]?.name ?? ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Section name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. A, B, Red"
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
        {!classesQ.isLoading && !classesQ.data?.length && (
          <p className="mb-4 text-sm text-muted-foreground">Create a class first.</p>
        )}
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search sections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {(classesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {sectionsQ.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Session</TableHead>
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
                      No sections found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => {
                    const cls = classesById[s.class_id];
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{cls?.name ?? "—"}</TableCell>
                        <TableCell>
                          {cls ? (sessionsById[cls.session_id]?.name ?? "—") : "—"}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
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
                                  <AlertDialogTitle>Delete section "{s.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => del.mutate(s.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
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
  );
}
