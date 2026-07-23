import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/examinations/grade-scales")({
  component: GradeScalesPage,
  head: () => ({ meta: [{ title: "Grade Scales — Examinations" }] }),
});

type Scale = { id: string; name: string; is_default: boolean; is_active: boolean };
type Band = { id: string; scale_id: string; min_percent: number; max_percent: number; grade: string; remark: string | null; sort_order: number };

function GradeScalesPage() {
  const { canManageExams } = useUserRoles();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [activeScaleId, setActiveScaleId] = useState<string | null>(null);

  const scales = useQuery({
    queryKey: ["exam-grade-scales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_grade_scales").select("*").order("name");
      if (error) throw error;
      return data as Scale[];
    },
  });

  const addScale = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("exam_grade_scales").insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Scale added"); setName(""); qc.invalidateQueries({ queryKey: ["exam-grade-scales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delScale = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_grade_scales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["exam-grade-scales"] }); if (activeScaleId) setActiveScaleId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Grade Scales" description="Define grading bands used for report cards." />

      <Card>
        <CardHeader><CardTitle className="text-base">Scales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canManageExams && (
            <div className="flex gap-2 items-end">
              <div><Label>Scale name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CBSE 10-point" /></div>
              <Button onClick={() => addScale.mutate()} disabled={addScale.isPending}>
                {addScale.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </Button>
            </div>
          )}
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Default</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {scales.data?.length ? scales.data.map((s) => (
                <TableRow key={s.id} className={activeScaleId === s.id ? "bg-muted/40" : ""}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.is_default && <Badge>Default</Badge>}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => setActiveScaleId(s.id)}>Manage Bands</Button>
                    {canManageExams && <Button size="sm" variant="ghost" onClick={() => delScale.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No scales yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {activeScaleId && <BandsEditor scaleId={activeScaleId} canEdit={canManageExams} />}
    </div>
  );
}

function BandsEditor({ scaleId, canEdit }: { scaleId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [grade, setGrade] = useState("");
  const [min, setMin] = useState<number>(0);
  const [max, setMax] = useState<number>(100);
  const [remark, setRemark] = useState("");

  const bands = useQuery({
    queryKey: ["exam-grade-bands", scaleId],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_grade_bands").select("*").eq("scale_id", scaleId).order("min_percent", { ascending: false });
      if (error) throw error;
      return data as Band[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!grade.trim()) throw new Error("Grade required");
      const { error } = await supabase.from("exam_grade_bands")
        .insert({ scale_id: scaleId, grade: grade.trim(), min_percent: min, max_percent: max, remark: remark.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { setGrade(""); setRemark(""); qc.invalidateQueries({ queryKey: ["exam-grade-bands", scaleId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_grade_bands").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-grade-bands", scaleId] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Bands</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader><TableRow><TableHead>Grade</TableHead><TableHead className="text-right">Min %</TableHead><TableHead className="text-right">Max %</TableHead><TableHead>Remark</TableHead>{canEdit && <TableHead></TableHead>}</TableRow></TableHeader>
          <TableBody>
            {bands.data?.length ? bands.data.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-semibold">{b.grade}</TableCell>
                <TableCell className="text-right">{b.min_percent}</TableCell>
                <TableCell className="text-right">{b.max_percent}</TableCell>
                <TableCell>{b.remark ?? "—"}</TableCell>
                {canEdit && <TableCell><Button variant="ghost" size="icon" onClick={() => del.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
              </TableRow>
            )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No bands yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-end pt-2 border-t">
            <div><Label className="text-xs">Grade</Label><Input className="h-8 w-20" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="A+" /></div>
            <div><Label className="text-xs">Min %</Label><Input className="h-8 w-24" type="number" value={min} onChange={(e) => setMin(Number(e.target.value) || 0)} /></div>
            <div><Label className="text-xs">Max %</Label><Input className="h-8 w-24" type="number" value={max} onChange={(e) => setMax(Number(e.target.value) || 0)} /></div>
            <div className="flex-1 min-w-48"><Label className="text-xs">Remark</Label><Input className="h-8" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Outstanding" /></div>
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
