import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";

type FeeHead = { id: string; name: string; description: string | null; is_mandatory: boolean; default_amount: number };

export function FeeHeadsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [form, setForm] = useState({ name: "", description: "", is_mandatory: false, default_amount: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ["fee_heads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_heads").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as FeeHead[];
    },
  });

  const openNew = () => { setEditing(null); setForm({ name: "", description: "", is_mandatory: false, default_amount: 0 }); setOpen(true); };
  const openEdit = (f: FeeHead) => { setEditing(f); setForm({ name: f.name, description: f.description ?? "", is_mandatory: f.is_mandatory, default_amount: Number(f.default_amount) }); setOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Fee head name is required");
      if (form.default_amount < 0) throw new Error("Amount must be non-negative");
      if (editing) {
        const { error } = await supabase.from("fee_heads").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_heads").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Fee head updated" : "Fee head created"); setOpen(false); qc.invalidateQueries({ queryKey: ["fee_heads"] }); },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "A fee head with that name already exists" : e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fee_heads").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Fee head deleted"); qc.invalidateQueries({ queryKey: ["fee_heads"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Fee Head Master</CardTitle>
          <CardDescription>Categories used to build fee structures (e.g. Tuition, Transport, Exam).</CardDescription>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> New fee head</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit fee head" : "New fee head"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tuition Fee" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-2"><Label>Default amount (₹)</Label><Input type="number" min={0} step="0.01" value={form.default_amount} onChange={(e) => setForm({ ...form, default_amount: Number(e.target.value) || 0 })} /></div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div><Label>Mandatory</Label><p className="text-xs text-muted-foreground">Charged to every student by default.</p></div>
                  <Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!canEdit && <ReadOnlyNotice />}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search fee heads..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Default (₹)</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead>Description</TableHead>
                  {canEdit && <TableHead className="w-[110px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 5 : 4} className="text-center text-sm text-muted-foreground py-8">No fee heads found</TableCell></TableRow>
                ) : filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>₹ {Number(f.default_amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>{f.is_mandatory ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                    <TableCell className="max-w-xs truncate">{f.description ?? "—"}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete fee head "{f.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(f.id)}>Delete</AlertDialogAction>
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
