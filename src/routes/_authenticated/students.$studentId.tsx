import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Pencil, ArrowUp, Archive } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";
import { PromoteDialog } from "@/components/students/promote-dialog";
import { ArchiveDialog } from "@/components/students/archive-dialog";
import { StudentFeesTab } from "@/components/students/student-fees-tab";


export const Route = createFileRoute("/_authenticated/students/$studentId")({
  component: StudentProfile,
  head: () => ({ meta: [{ title: "Student Profile — School ERP" }] }),
});

function StudentProfile() {
  const { studentId } = Route.useParams();
  const perms = useUserRoles();
  const [promote, setPromote] = useState(false);
  const [archive, setArchive] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data: s, error } = await supabase.from("students").select("*").eq("id", studentId).single();
      if (error) throw error;
      const { data: recs, error: rErr } = await supabase
        .from("student_academic_records")
        .select("*, academic_sessions:academic_session_id(name), school_classes:class_id(name), school_sections:section_id(name), houses:house_id(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (rErr) throw rErr;
      return { student: s, records: recs ?? [] };
    },
  });

  if (isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  if (!data) return <p className="text-sm text-muted-foreground">Student not found.</p>;

  const s = data.student;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = data.records as any[];
  const current = records[0] ?? null;

  return (
    <div>
      <PageHeader
        title={s.full_name}
        description={`Scholar No. ${s.scholar_number}${current ? ` • ${current.school_classes?.name ?? ""} ${current.school_sections?.name ?? ""}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/students"><ArrowLeft className="h-4 w-4" /> Back</Link></Button>
            {perms.canEditStudent && (
              <Button variant="outline" asChild>
                <Link to="/students/$studentId/edit" params={{ studentId }}><Pencil className="h-4 w-4" /> Edit</Link>
              </Button>
            )}
            {perms.canPromoteStudent && (
              <Button variant="outline" onClick={() => setPromote(true)}><ArrowUp className="h-4 w-4" /> Promote</Button>
            )}
            {perms.canArchiveStudent && (
              <Button variant="outline" onClick={() => setArchive(true)}><Archive className="h-4 w-4" /> Archive</Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="info">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 mb-4">
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="academic">Academic History</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card><CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <Info label="Gender" value={s.gender} />
            <Info label="Date of Birth" value={s.date_of_birth} />
            <Info label="Date of Admission" value={s.date_of_admission} />
            <Info label="Admission Type" value={s.admission_type} />
            <Info label="Aadhaar" value={s.aadhaar_number} />
            <Info label="APAAR ID" value={s.apaar_id} />
            <Info label="PEN ID" value={s.pen_id} />
            <Info label="Samagra ID" value={s.samagra_id} />
            <Info label="Nationality" value={s.nationality} />
            <Info label="Religion" value={s.religion} />
            <Info label="Category" value={s.category} />
            <Info label="Caste" value={s.caste} />
            <Info label="Blood Group" value={s.blood_group} />
            <Info label="Mother Tongue" value={s.mother_tongue} />
            <Info label="Father" value={`${s.father_name ?? "—"} • ${s.father_mobile ?? "—"}`} />
            <Info label="Father Email" value={s.father_email} />
            <Info label="Mother" value={`${s.mother_name ?? "—"} • ${s.mother_mobile ?? "—"}`} />
            <Info label="Mother Email" value={s.mother_email} />
            <Info label="Guardian" value={`${s.guardian_name ?? "—"} • ${s.guardian_phone ?? "—"}`} />
            <Info label="Emergency" value={`${s.emergency_contact_name ?? "—"} • ${s.emergency_contact_number ?? "—"}`} />
            <Info label="Address" value={[s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ")} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="academic">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Session</TableHead><TableHead>Class</TableHead><TableHead>Section</TableHead>
                <TableHead>Roll</TableHead><TableHead>House</TableHead><TableHead>Joined</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No academic records yet.</TableCell></TableRow>
                ) : records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.academic_sessions?.name ?? "—"}</TableCell>
                    <TableCell>{r.school_classes?.name ?? "—"}</TableCell>
                    <TableCell>{r.school_sections?.name ?? "—"}</TableCell>
                    <TableCell>{r.roll_number ?? "—"}</TableCell>
                    <TableCell>{r.houses?.name ?? "—"}</TableCell>
                    <TableCell>{r.joined_on ? new Date(r.joined_on).toLocaleDateString("en-IN") : "—"}</TableCell>
                    <TableCell><Badge variant={r.status === "Active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="p-6 space-y-3 text-sm">
            <ActivityItem date={s.created_at} label="Profile created" />
            {s.date_of_admission && <ActivityItem date={s.date_of_admission} label={`Admitted (${s.admission_type ?? "—"})`} />}
            {records.slice().reverse().map((r) => (
              <ActivityItem
                key={r.id}
                date={r.created_at}
                label={`${r.promoted_from_record_id ? "Promoted to" : "Enrolled in"} ${r.academic_sessions?.name ?? ""} — ${r.school_classes?.name ?? ""} ${r.school_sections?.name ?? ""} (${r.status})`}
              />
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Fee summary will appear here once Fee Management is integrated.</CardContent></Card>
        </TabsContent>
        <TabsContent value="attendance">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Attendance summary will appear here once linked to this student.</CardContent></Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card><CardContent className="p-6 space-y-2 text-sm">
            <DocLine label="Photograph" path={s.photo_url} />
            <DocLine label="Birth Certificate" path={s.birth_certificate_url} />
            <DocLine label="Aadhaar Copy" path={s.aadhaar_copy_url} />
            <DocLine label="Transfer Certificate" path={s.transfer_certificate_url} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {promote && (
        <PromoteDialog open onOpenChange={setPromote} studentId={studentId} studentName={s.full_name} currentRecordId={current?.id ?? null} />
      )}
      {archive && (
        <ArchiveDialog open onOpenChange={setArchive} studentId={studentId} studentName={s.full_name} currentRecordId={current?.id ?? null} />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-dashed last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function ActivityItem({ date, label }: { date?: string | null; label: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{date ? new Date(date).toLocaleString("en-IN") : "—"}</p>
      </div>
    </div>
  );
}

function DocLine({ label, path }: { label: string; path?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed py-2 last:border-0">
      <span>{label}</span>
      <span className="text-muted-foreground text-xs">{path ? "Uploaded" : "Not uploaded"}</span>
    </div>
  );
}
