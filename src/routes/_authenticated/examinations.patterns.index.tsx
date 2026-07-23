import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, GitBranch, Loader2, Lock } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/examinations/patterns/")({
  component: PatternsListPage,
  head: () => ({ meta: [{ title: "Exam Patterns — Examinations" }] }),
});

type Pattern = { id: string; name: string; version: number; academic_session_id: string; is_active: boolean; is_locked: boolean; parent_pattern_id: string | null };
type Session = { id: string; name: string; status: string };

function PatternsListPage() {
  const { canManageExams } = useUserRoles();
  const qc = useQueryClient();
  const nav = useNavigate();

  const sessions = useQuery({
    queryKey: ["academic-sessions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("id, name, status").order("start_date", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  const patterns = useQuery({
    queryKey: ["exam-patterns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_patterns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pattern[];
    },
  });

  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSession, setNewSession] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!newName.trim() || !newSession) throw new Error("Session and name required");
      const { data, error } = await supabase.from("exam_patterns")
        .insert({ name: newName.trim(), academic_session_id: newSession }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { setOpenNew(false); setNewName(""); toast.success("Pattern created"); qc.invalidateQueries({ queryKey: ["exam-patterns"] }); nav({ to: "/examinations/patterns/$patternId", params: { patternId: id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [cloneOpen, setCloneOpen] = useState<Pattern | null>(null);
  const [cloneSession, setCloneSession] = useState("");
  const [cloneName, setCloneName] = useState("");
  const clone = useMutation({
    mutationFn: async () => {
      if (!cloneOpen) return null;
      const { data, error } = await (supabase as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }> })
        .rpc("clone_exam_pattern", { _source_id: cloneOpen.id, _new_session_id: cloneSession, _new_name: cloneName || cloneOpen.name });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => { setCloneOpen(null); toast.success("Cloned"); qc.invalidateQueries({ queryKey: ["exam-patterns"] }); if (id) nav({ to: "/examinations/patterns/$patternId", params: { patternId: id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const version = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: string | null; error: Error | null }> })
        .rpc("version_exam_pattern", { _source_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (id) => { toast.success("New version created"); qc.invalidateQueries({ queryKey: ["exam-patterns"] }); if (id) nav({ to: "/examinations/patterns/$patternId", params: { patternId: id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionName = (id: string) => sessions.data?.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Exam Patterns"
        description="Versioned exam schemes per session. Clone across sessions or create a new version after a pattern is locked."
        actions={canManageExams && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New Pattern</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Exam Pattern</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Academic Session</Label>
                  <Select value={newSession} onValueChange={setNewSession}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{sessions.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Pattern name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Primary Term Pattern" /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Session</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {patterns.data?.length ? patterns.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link to="/examinations/patterns/$patternId" params={{ patternId: p.id }} className="text-primary hover:underline">{p.name}</Link>
                  </TableCell>
                  <TableCell>{sessionName(p.academic_session_id)}</TableCell>
                  <TableCell>v{p.version}</TableCell>
                  <TableCell>
                    {p.is_locked && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>}
                    {!p.is_locked && p.is_active && <Badge>Active</Badge>}
                    {!p.is_active && <Badge variant="outline">Superseded</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {canManageExams && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setCloneOpen(p); setCloneSession(""); setCloneName(p.name); }}>
                          <Copy className="h-3 w-3" /> Clone
                        </Button>
                        {p.is_locked && (
                          <Button size="sm" variant="outline" onClick={() => version.mutate(p.id)} disabled={version.isPending}>
                            <GitBranch className="h-3 w-3" /> New Version
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No patterns yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!cloneOpen} onOpenChange={(o) => !o && setCloneOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Clone Pattern</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Target session</Label>
              <Select value={cloneSession} onValueChange={setCloneSession}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{sessions.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>New name (optional)</Label><Input value={cloneName} onChange={(e) => setCloneName(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={() => clone.mutate()} disabled={clone.isPending || !cloneSession}>{clone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Clone</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
