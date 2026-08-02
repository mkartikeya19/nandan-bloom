import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/examinations/subjects")({
  component: SubjectsPage,
  head: () => ({ meta: [{ title: "Subjects — Examinations" }] }),
});

type Subject = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  sort_order: number;
};
type ClassRow = { id: string; name: string };
type ClassSubject = {
  id: string;
  class_id: string;
  subject_id: string;
  is_active: boolean;
  sort_order: number;
};
type Component = {
  id: string;
  class_subject_id: string;
  name: string;
  max_marks: number;
  is_practical: boolean;
  sort_order: number;
};

function SubjectsPage() {
  const { canManageExams } = useUserRoles();
  return (
    <div>
      <PageHeader
        title="Subjects"
        description="Manage the global subject list and assign subjects to each class with assessment components."
      />
      <Tabs defaultValue="global">
        <TabsList>
          <TabsTrigger value="global">Global Subjects</TabsTrigger>
          <TabsTrigger value="class">Class-wise Mapping</TabsTrigger>
        </TabsList>
        <TabsContent value="global" className="mt-4">
          <GlobalSubjects canEdit={canManageExams} />
        </TabsContent>
        <TabsContent value="class" className="mt-4">
          <ClassMapping canEdit={canManageExams} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GlobalSubjects({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const subs = useQuery({
    queryKey: ["exam-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as Subject[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase
        .from("exam_subjects")
        .insert({ name: name.trim(), code: code.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject added");
      setName("");
      setCode("");
      qc.invalidateQueries({ queryKey: ["exam-subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("exam_subjects").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-subjects"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["exam-subjects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subject Master</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mathematics"
              />
            </div>
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="MATH" />
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{" "}
              Add
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Active</TableHead>
              {canEdit && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {subs.data?.length ? (
              subs.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.code ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_active}
                      disabled={!canEdit}
                      onCheckedChange={(v) => toggle.mutate({ id: s.id, is_active: v })}
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No subjects yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ClassMapping({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");

  const classes = useQuery({
    queryKey: ["classes-for-exam"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_classes")
        .select("id, name")
        .order("sort_order");
      if (error) throw error;
      return data as ClassRow[];
    },
  });

  const subs = useQuery({
    queryKey: ["exam-subjects-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Subject[];
    },
  });

  const cs = useQuery({
    queryKey: ["exam-class-subjects", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_class_subjects")
        .select("*")
        .eq("class_id", classId)
        .order("sort_order");
      if (error) throw error;
      return data as ClassSubject[];
    },
  });

  const addSubject = useMutation({
    mutationFn: async (subject_id: string) => {
      const { error } = await supabase
        .from("exam_class_subjects")
        .insert({ class_id: classId, subject_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to class");
      qc.invalidateQueries({ queryKey: ["exam-class-subjects", classId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSubject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_class_subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-class-subjects", classId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const mapped = useMemo(() => new Set((cs.data ?? []).map((r) => r.subject_id)), [cs.data]);
  const available = (subs.data ?? []).filter((s) => !mapped.has(s.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Choose class" />
            </SelectTrigger>
            <SelectContent>
              {classes.data?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {classId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned Subjects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canEdit && available.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {available.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant="outline"
                      onClick={() => addSubject.mutate(s.id)}
                    >
                      <Plus className="h-3 w-3" /> {s.name}
                    </Button>
                  ))}
                </div>
              )}
              {cs.data?.length ? (
                <div className="space-y-3">
                  {cs.data.map((r) => {
                    const subject = subs.data?.find((s) => s.id === r.subject_id);
                    return (
                      <ClassSubjectRow
                        key={r.id}
                        row={r}
                        subjectName={subject?.name ?? "—"}
                        canEdit={canEdit}
                        onDelete={() => removeSubject.mutate(r.id)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No subjects assigned to this class yet.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ClassSubjectRow({
  row,
  subjectName,
  canEdit,
  onDelete,
}: {
  row: ClassSubject;
  subjectName: string;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [isPractical, setIsPractical] = useState(false);

  const comps = useQuery({
    queryKey: ["exam-components", row.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_class_subject_components")
        .select("*")
        .eq("class_subject_id", row.id)
        .order("sort_order");
      if (error) throw error;
      return data as Component[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Component name required");
      if (!(maxMarks > 0)) throw new Error("Max marks must be > 0");
      const { error } = await supabase.from("exam_class_subject_components").insert({
        class_subject_id: row.id,
        name: name.trim(),
        max_marks: maxMarks,
        is_practical: isPractical,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setMaxMarks(100);
      setIsPractical(false);
      qc.invalidateQueries({ queryKey: ["exam-components", row.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_class_subject_components").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-components", row.id] }),
  });

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">{subjectName}</div>
        {canEdit && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Component</TableHead>
            <TableHead className="text-right">Max Marks</TableHead>
            <TableHead>Type</TableHead>
            {canEdit && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comps.data?.length ? (
            comps.data.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="text-right">{c.max_marks}</TableCell>
                <TableCell>
                  {c.is_practical ? (
                    <Badge variant="secondary">Practical</Badge>
                  ) : (
                    <Badge variant="outline">Theory</Badge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-xs text-muted-foreground text-center py-3">
                No components yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-end pt-2">
          <div>
            <Label className="text-xs">Component</Label>
            <Input
              className="h-8"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Theory / Practical / Oral"
            />
          </div>
          <div>
            <Label className="text-xs">Max Marks</Label>
            <Input
              className="h-8 w-24"
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(Number(e.target.value) || 0)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={isPractical} onCheckedChange={setIsPractical} /> Practical
          </label>
          <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>
            {add.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}{" "}
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
