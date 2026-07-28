import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Upload } from "lucide-react";
import { logActivity } from "@/lib/activity";
import {
  TEACHER_DOC_TYPES, type TeacherDocumentRow, getSignedTeacherUrl, uploadTeacherFile,
} from "@/lib/teachers-helpers";

interface Props {
  teacherId: string;
  employeeCode: string;
  canEdit: boolean;
}

export function TeacherDocuments({ teacherId, employeeCode, canEdit }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docs } = useQuery({
    queryKey: ["teacher-documents", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_documents")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TeacherDocumentRow[];
    },
  });

  const { data: uploaderNames } = useQuery({
    enabled: (docs ?? []).length > 0,
    queryKey: ["teacher-doc-uploaders", (docs ?? []).map((d) => d.uploaded_by).join(",")],
    queryFn: async () => {
      const ids = Array.from(new Set((docs ?? []).map((d) => d.uploaded_by).filter(Boolean) as string[]));
      if (ids.length === 0) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.full_name ?? p.email ?? "—"; });
      return map;
    },
  });

  const latestFor = (type: string) => (docs ?? []).find((d) => d.doc_type === type) ?? null;

  const upload = useMutation({
    mutationFn: async ({ type, file }: { type: string; file: File }) => {
      const existing = latestFor(type);
      const path = await uploadTeacherFile(employeeCode, file);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      if (existing) {
        const { error } = await supabase
          .from("teacher_documents")
          .update({ file_path: path, uploaded_by: uid, label: file.name })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("teacher_documents")
          .insert({ teacher_id: teacherId, doc_type: type, file_path: path, uploaded_by: uid, label: file.name });
        if (error) throw error;
      }

      await logActivity({
        module: "Teachers",
        action: existing ? "Document Replaced" : "Document Uploaded",
        entityType: "teacher",
        entityId: teacherId,
        details: { document: type, employee_code: employeeCode, file: file.name },
      });
    },
    onSuccess: () => {
      toast.success("Document saved");
      qc.invalidateQueries({ queryKey: ["teacher-documents", teacherId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  const open = async (path: string, download = false) => {
    const url = await getSignedTeacherUrl(path);
    if (!url) return toast.error("Could not open the file");
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (download) a.download = path.split("/").pop() ?? "document";
    a.click();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
      <CardContent className="divide-y">
        {TEACHER_DOC_TYPES.map((type) => {
          const doc = latestFor(type);
          return (
            <div key={type} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{type}</p>
                {doc ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.label ?? doc.file_path.split("/").pop()} · uploaded{" "}
                    {new Date(doc.updated_at).toLocaleDateString("en-IN")} by{" "}
                    {doc.uploaded_by ? (uploaderNames?.[doc.uploaded_by] ?? "—") : "—"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Not uploaded</p>
                )}
              </div>
              {doc ? <Badge variant="secondary">Uploaded</Badge> : <Badge variant="outline">Missing</Badge>}
              <div className="flex items-center gap-1">
                {doc && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => open(doc.file_path)}><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => open(doc.file_path, true)}><Download className="h-4 w-4" /></Button>
                  </>
                )}
                {canEdit && (
                  <>
                    <input
                      type="file"
                      hidden
                      ref={(el) => { inputs.current[type] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setBusy(type);
                        upload.mutate({ type, file });
                      }}
                    />
                    <Button size="sm" variant="outline" disabled={busy === type}
                      onClick={() => inputs.current[type]?.click()}>
                      <Upload className="h-4 w-4" />
                      {busy === type ? "Uploading…" : doc ? "Replace" : "Upload"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
