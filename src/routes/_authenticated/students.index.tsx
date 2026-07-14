import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, Plus, Search, Upload, MoreHorizontal, Eye, Pencil, ArrowUp, Archive, UserX } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";
import { STUDENT_STATUS_VALUES, type StudentStatus } from "@/lib/students-helpers";
import { PromoteDialog } from "@/components/students/promote-dialog";
import { ArchiveDialog } from "@/components/students/archive-dialog";
import { MarkLeftDialog } from "@/components/students/mark-left-dialog";

export const Route = createFileRoute("/_authenticated/students/")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "Students — School ERP" }] }),
});

const PAGE_SIZE = 25;

function StudentsPage() {
  const nav = useNavigate();
  const perms = useUserRoles();
  const [q, setQ] = useState("");
  const [sessionId, setSessionId] = useState<string>("all");
  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [promote, setPromote] = useState<{ id: string; name: string; recordId: string | null } | null>(null);
  const [archive, setArchive] = useState<{ id: string; name: string; recordId: string | null } | null>(null);
  const [markLeft, setMarkLeft] = useState<{ id: string; name: string; recordId: string | null } | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ["ref-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("id, name, is_active").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: classes } = useQuery({
    queryKey: ["ref-classes-filter", sessionId],
    enabled: sessionId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase.from("school_classes").select("id, name, order_index").eq("session_id", sessionId).order("order_index");
      if (error) throw error;
      return data;
    },
  });
  const { data: sections } = useQuery({
    queryKey: ["ref-sections-filter", classId],
    enabled: classId !== "all",
    queryFn: async () => {
      const { data, error } = await supabase.from("school_sections").select("id, name").eq("class_id", classId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["students", { q, sessionId, classId, sectionId, statusFilter, page }],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select(
          `
          id, scholar_number, full_name, father_name, gender, guardian_phone, status, date_of_admission,
          student_academic_records!left(id, roll_number, status, academic_session_id, class_id, section_id, created_at,
            academic_sessions:academic_session_id(id, name, is_active),
            school_classes:class_id(id, name, order_index),
            school_sections:section_id(id, name))
        `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (q) {
        query = query.or(
          `full_name.ilike.%${q}%,scholar_number.ilike.%${q}%,father_name.ilike.%${q}%`,
        );
      }
      const { data, error, count } = await query;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (data as any[]).map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recs = (s.student_academic_records ?? []) as any[];
        recs.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        const current = recs[0] ?? null;
        return { ...s, current };
      });
      // Apply post-filters (session/class/section/status refer to current record)
      const filtered = rows.filter((r) => {
        if (sessionId !== "all" && r.current?.academic_session_id !== sessionId) return false;
        if (classId !== "all" && r.current?.class_id !== classId) return false;
        if (sectionId !== "all" && r.current?.section_id !== sectionId) return false;
        if (statusFilter !== "all" && r.current?.status !== statusFilter) return false;
        return true;
      });
      return { rows: filtered, count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Students"
        description="Directory of all enrolled students."
        actions={
          <div className="flex gap-2">
            {perms.canCreateStudent && (
              <>
                <Button variant="outline" asChild>
                  <Link to="/students/import"><Upload className="h-4 w-4" /> Import</Link>
                </Button>
                <Button asChild>
                  <Link to="/students/new"><Plus className="h-4 w-4" /> New Admission</Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scholar no., name, father's name"
              className="pl-9"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
            />
          </div>
          <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setClassId("all"); setSectionId("all"); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Session" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions</SelectItem>
              {sessions?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId("all"); setPage(0); }} disabled={sessionId === "all"}>
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sectionId} onValueChange={(v) => { setSectionId(v); setPage(0); }} disabled={classId === "all"}>
            <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sections?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STUDENT_STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students match"
          description="Try adjusting your search or filters, or add a new admission."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scholar No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Father</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Admitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.scholar_number}</TableCell>
                    <TableCell className="font-medium">
                      <Link to="/students/$studentId" params={{ studentId: s.id }} className="hover:underline">
                        {s.full_name}
                      </Link>
                    </TableCell>
                    <TableCell>{s.father_name ?? "—"}</TableCell>
                    <TableCell>{s.current?.academic_sessions?.name ?? "—"}</TableCell>
                    <TableCell>{s.current?.school_classes?.name ?? "—"}</TableCell>
                    <TableCell>{s.current?.school_sections?.name ?? "—"}</TableCell>
                    <TableCell>{s.current?.roll_number ?? "—"}</TableCell>
                    <TableCell>{s.date_of_admission ? new Date(s.date_of_admission).toLocaleDateString("en-IN") : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.current?.status === "Active" ? "default" : "secondary"}>
                        {s.current?.status ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => nav({ to: "/students/$studentId", params: { studentId: s.id } })}>
                            <Eye className="h-4 w-4" /> View
                          </DropdownMenuItem>
                          {perms.canEditStudent && (
                            <DropdownMenuItem onClick={() => nav({ to: "/students/$studentId/edit", params: { studentId: s.id } })}>
                              <Pencil className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          {perms.canPromoteStudent && (
                            <DropdownMenuItem onClick={() => setPromote({ id: s.id, name: s.full_name, recordId: s.current?.id ?? null })}>
                              <ArrowUp className="h-4 w-4" /> Promote
                            </DropdownMenuItem>
                          )}
                          {perms.canEditStudent && (
                            <DropdownMenuItem onClick={() => setMarkLeft({ id: s.id, name: s.full_name, recordId: s.current?.id ?? null })}>
                              <UserX className="h-4 w-4" /> Mark as Left
                            </DropdownMenuItem>
                          )}
                          {perms.canArchiveStudent && (
                            <DropdownMenuItem onClick={() => setArchive({ id: s.id, name: s.full_name, recordId: s.current?.id ?? null })}>
                              <Archive className="h-4 w-4" /> Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {pageCount} — {total} student(s)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {promote && (
        <PromoteDialog
          open
          onOpenChange={(o) => !o && setPromote(null)}
          studentId={promote.id}
          studentName={promote.name}
          currentRecordId={promote.recordId}
        />
      )}
      {archive && (
        <ArchiveDialog
          open
          onOpenChange={(o) => !o && setArchive(null)}
          studentId={archive.id}
          studentName={archive.name}
          currentRecordId={archive.recordId}
        />
      )}
      {markLeft && (
        <MarkLeftDialog
          open
          onOpenChange={(o) => !o && setMarkLeft(null)}
          studentId={markLeft.id}
          studentName={markLeft.name}
          currentRecordId={markLeft.recordId}
        />
      )}
    </div>
  );
}
