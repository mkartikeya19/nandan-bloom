import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Loader2, Lock } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/examinations/patterns/$patternId")({
  component: PatternEditor,
});

type Pattern = { id: string; name: string; version: number; is_locked: boolean; is_active: boolean; grade_scale_id: string | null; academic_session_id: string };
type Term = { id: string; pattern_id: string; name: string; weightage_percent: number; include_in_final: boolean; sort_order: number };
type PClass = { id: string; pattern_id: string; class_id: string };
type Scale = { id: string; name: string };
type ClassRow = { id: string; name: string };

function PatternEditor() {
  const { patternId } = Route.useParams();
  const { canManageExams } = useUserRoles();
  const qc = useQueryClient();

  const pattern = useQuery({
    queryKey: ["exam-pattern", patternId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_patterns").select("*").eq("id", patternId).single();
      if (error) throw error;
      return data as Pattern;
    },
  });

  const scales = useQuery({
    queryKey: ["exam-grade-scales-list"],
    queryFn: async () => (await supabase.from("exam_grade_scales").select("id, name").eq("is_active", true).order("name")).data as Scale[] | null,
  });

  const classes = useQuery({
    queryKey: ["classes-for-pattern"],
    queryFn: async () => (await supabase.from("school_classes").select("id, name").order("sort_order")).data as ClassRow[] | null,
  });

  const terms = useQuery({
    queryKey: ["exam-pattern-terms", patternId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_pattern_terms").select("*").eq("pattern_id", patternId).order("sort_order");
      if (error) throw error;
      return data as Term[];
    },
  });

  const pclasses = useQuery({
    queryKey: ["exam-pattern-classes", patternId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_pattern_classes").select("*").eq("pattern_id", patternId);
      if (error) throw error;
      return data as PClass[];
    },
  });

  const locked = !!pattern.data?.is_locked;
  const canEdit = canManageExams && !locked;

  const setGradeScale = useMutation({
    mutationFn: async (id: string | null) => {
      const { error } = await supabase.from("exam_patterns").update({ grade_scale_id: id }).eq("id", patternId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-pattern", patternId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const totalWeight = useMemo(() => (terms.data ?? []).filter((t) => t.include_in_final).reduce((s, t) => s + Number(t.weightage_percent), 0), [terms.data]);

  return (
    <div>
      <PageHeader
        title={pattern.data ? `${pattern.data.name} · v${pattern.data.version}` : "Pattern"}
        description="Add terms, weightages, and the classes this pattern applies to."
        actions={
          <div className="flex gap-2 items-center">
            {locked && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Locked — create a new version to edit</Badge>}
            <Button asChild variant="outline" size="sm"><Link to="/examinations/patterns"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Terms</CardTitle>
            <div className="text-xs text-muted-foreground">Weight in final: <span className={totalWeight === 100 ? "text-primary font-semibold" : "text-destructive font-semibold"}>{totalWeight}%</span></div>
          </CardHeader>
          <CardContent>
            <TermsTable terms={terms.data ?? []} patternId={patternId} canEdit={canEdit} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Grade Scale</Label>
              <Select value={pattern.data?.grade_scale_id ?? ""} onValueChange={(v) => setGradeScale.mutate(v || null)} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>{scales.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Applicable Classes</CardTitle></CardHeader>
          <CardContent>
            <ClassesGrid patternId={patternId} classes={classes.data ?? []} assigned={pclasses.data ?? []} canEdit={canEdit} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TermsTable({ terms, patternId, canEdit }: { terms: Term[]; patternId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState<number>(0);
  const [inFinal, setInFinal] = useState(true);

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("exam_pattern_terms")
        .insert({ pattern_id: patternId, name: name.trim(), weightage_percent: weight, include_in_final: inFinal, sort_order: terms.length });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setWeight(0); setInFinal(true); qc.invalidateQueries({ queryKey: ["exam-pattern-terms", patternId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_pattern_terms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-pattern-terms", patternId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader><TableRow><TableHead>Term</TableHead><TableHead className="text-right">Weight %</TableHead><TableHead>In Final</TableHead>{canEdit && <TableHead></TableHead>}</TableRow></TableHeader>
        <TableBody>
          {terms.length ? terms.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.name}</TableCell>
              <TableCell className="text-right">{t.weightage_percent}</TableCell>
              <TableCell>{t.include_in_final ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
              {canEdit && <TableCell><Button variant="ghost" size="icon" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
            </TableRow>
          )) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No terms yet.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-end pt-2 border-t">
          <div><Label className="text-xs">Term name</Label><Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} placeholder="Unit Test 1" /></div>
          <div><Label className="text-xs">Weight %</Label><Input className="h-8 w-24" type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} /></div>
          <label className="flex items-center gap-2 text-xs"><Switch checked={inFinal} onCheckedChange={setInFinal} /> Include in Final</label>
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
          </Button>
        </div>
      )}
    </div>
  );
}

function ClassesGrid({ patternId, classes, assigned, canEdit }: { patternId: string; classes: ClassRow[]; assigned: PClass[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const assignedSet = new Set(assigned.map((a) => a.class_id));

  const toggle = useMutation({
    mutationFn: async (classId: string) => {
      if (assignedSet.has(classId)) {
        const { error } = await supabase.from("exam_pattern_classes").delete().eq("pattern_id", patternId).eq("class_id", classId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exam_pattern_classes").insert({ pattern_id: patternId, class_id: classId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-pattern-classes", patternId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      {classes.map((c) => {
        const on = assignedSet.has(c.id);
        return (
          <Button key={c.id} size="sm" variant={on ? "default" : "outline"} disabled={!canEdit} onClick={() => toggle.mutate(c.id)}>
            {c.name}
          </Button>
        );
      })}
      {classes.length === 0 && <p className="text-sm text-muted-foreground">No classes defined. Add classes in Settings.</p>}
    </div>
  );
}
