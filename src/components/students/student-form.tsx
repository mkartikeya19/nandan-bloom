import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  fetchNextScholarNumber,
  uploadStudentFile,
  STUDENT_STATUS_VALUES,
  ADMISSION_TYPE_VALUES,
  type StudentStatus,
  type AdmissionType,
} from "@/lib/students-helpers";
import { logActivity } from "@/lib/activity";

type Mode = "new" | "edit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StudentRow = any;

interface Props {
  mode: Mode;
  student?: StudentRow;
  currentRecord?: {
    id: string;
    academic_session_id: string;
    class_id: string;
    section_id: string;
    house_id: string | null;
    roll_number: string | null;
    joined_on: string;
    status: StudentStatus;
  } | null;
  onSaved?: (studentId: string) => void;
}

const empty = {
  scholar_number: "",
  full_name: "",
  gender: "",
  date_of_birth: "",
  date_of_admission: new Date().toISOString().slice(0, 10),
  admission_type: "New Admission" as AdmissionType,
  aadhaar_number: "",
  apaar_id: "",
  pen_id: "",
  samagra_id: "",
  nationality: "Indian",
  religion: "",
  category: "",
  caste: "",
  blood_group: "",
  mother_tongue: "",
  father_name: "",
  father_mobile: "",
  father_occupation: "",
  father_email: "",
  mother_name: "",
  mother_mobile: "",
  mother_occupation: "",
  mother_email: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  emergency_contact_name: "",
  emergency_contact_number: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
};

const emptyAcad = {
  academic_session_id: "",
  class_id: "",
  section_id: "",
  roll_number: "",
  house_id: "",
  joined_on: new Date().toISOString().slice(0, 10),
  status: "Active" as StudentStatus,
};

export function StudentForm({ mode, student, currentRecord, onSaved }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("basic");
  const [form, setForm] = useState({ ...empty });
  const [acad, setAcad] = useState({ ...emptyAcad });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [birthCertFile, setBirthCertFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [tcFile, setTcFile] = useState<File | null>(null);

  // Reference data
  const { data: sessions } = useQuery({
    queryKey: ["ref-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("id, name, is_active")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["ref-classes", acad.academic_session_id],
    enabled: !!acad.academic_session_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_classes")
        .select("id, name, order_index")
        .eq("session_id", acad.academic_session_id)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: sections } = useQuery({
    queryKey: ["ref-sections", acad.class_id],
    enabled: !!acad.class_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_sections")
        .select("id, name")
        .eq("class_id", acad.class_id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: houses } = useQuery({
    queryKey: ["ref-houses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Prefill
  useEffect(() => {
    if (mode === "edit" && student) {
      setForm({
        scholar_number: student.scholar_number ?? "",
        full_name: student.full_name ?? "",
        gender: student.gender ?? "",
        date_of_birth: student.date_of_birth ?? "",
        date_of_admission: student.date_of_admission ?? "",
        admission_type: (student.admission_type as AdmissionType) ?? "New Admission",
        aadhaar_number: student.aadhaar_number ?? "",
        apaar_id: student.apaar_id ?? "",
        pen_id: student.pen_id ?? "",
        samagra_id: student.samagra_id ?? "",
        nationality: student.nationality ?? "Indian",
        religion: student.religion ?? "",
        category: student.category ?? "",
        caste: student.caste ?? "",
        blood_group: student.blood_group ?? "",
        mother_tongue: student.mother_tongue ?? "",
        father_name: student.father_name ?? "",
        father_mobile: student.father_mobile ?? "",
        father_occupation: student.father_occupation ?? "",
        father_email: student.father_email ?? "",
        mother_name: student.mother_name ?? "",
        mother_mobile: student.mother_mobile ?? "",
        mother_occupation: student.mother_occupation ?? "",
        mother_email: student.mother_email ?? "",
        guardian_name: student.guardian_name ?? "",
        guardian_phone: student.guardian_phone ?? "",
        guardian_email: student.guardian_email ?? "",
        emergency_contact_name: student.emergency_contact_name ?? "",
        emergency_contact_number: student.emergency_contact_number ?? "",
        address: student.address ?? "",
        city: student.city ?? "",
        state: student.state ?? "",
        pincode: student.pincode ?? "",
      });
      if (currentRecord) {
        setAcad({
          academic_session_id: currentRecord.academic_session_id,
          class_id: currentRecord.class_id,
          section_id: currentRecord.section_id,
          roll_number: currentRecord.roll_number ?? "",
          house_id: currentRecord.house_id ?? "",
          joined_on: currentRecord.joined_on,
          status: currentRecord.status,
        });
      }
    } else if (mode === "new") {
      fetchNextScholarNumber()
        .then((n) => setForm((f) => ({ ...f, scholar_number: n })))
        .catch(() => toast.error("Could not fetch next Scholar Number"));
      // Preselect active session
      if (sessions) {
        const active = sessions.find((s) => s.is_active);
        if (active) setAcad((a) => ({ ...a, academic_session_id: active.id }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, student, currentRecord, sessions?.length]);

  const mandatoryErrors: Record<string, string> = {};
  if (mode === "new") {
    if (!form.full_name.trim()) mandatoryErrors.full_name = "Student name is required";
    if (!form.scholar_number.trim()) mandatoryErrors.scholar_number = "Scholar number missing";
    if (!form.gender) mandatoryErrors.gender = "Gender is required";
    if (!form.date_of_birth) mandatoryErrors.date_of_birth = "Date of birth is required";
    if (!form.date_of_admission)
      mandatoryErrors.date_of_admission = "Date of admission is required";
    if (!form.father_name.trim()) mandatoryErrors.father_name = "Father name is required";
    if (!form.father_mobile.trim()) mandatoryErrors.father_mobile = "Father mobile is required";
    if (!form.mother_name.trim()) mandatoryErrors.mother_name = "Mother name is required";
    if (!form.mother_mobile.trim()) mandatoryErrors.mother_mobile = "Mother mobile is required";
    if (!acad.academic_session_id)
      mandatoryErrors.academic_session_id = "Academic session is required";
    if (!acad.class_id) mandatoryErrors.class_id = "Class is required";
    // Section is only mandatory when sections exist for the selected class.
    if (acad.class_id && (sections?.length ?? 0) > 0 && !acad.section_id) {
      mandatoryErrors.section_id = "Section is required";
    }
    // Roll number is assigned automatically post-admission and regenerated on promotion.
  }
  const canSubmit = mode === "edit" || Object.keys(mandatoryErrors).length === 0;

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "new" && Object.keys(mandatoryErrors).length > 0) {
        throw new Error("Please complete all required fields");
      }

      const payload = {
        ...form,
        admission_number: form.scholar_number, // keep internal alignment
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
      };

      let studentId: string;
      if (mode === "new") {
        const { data, error } = await supabase.rpc("admit_student_with_fee_structure", {
          _student_payload: payload,
          _academic_payload: {
            academic_session_id: acad.academic_session_id,
            class_id: acad.class_id,
            section_id: acad.section_id,
            roll_number: acad.roll_number || null,
            house_id: acad.house_id || null,
            joined_on: acad.joined_on,
            status: acad.status,
          },
        });
        if (error) throw error;
        studentId = String((data as { student_id?: string } | null)?.student_id);
      } else {
        studentId = student.id;
        const { error } = await supabase.from("students").update(payload).eq("id", studentId);
        if (error) throw error;

        if (currentRecord) {
          const { error: arErr } = await supabase
            .from("student_academic_records")
            .update({
              academic_session_id: acad.academic_session_id,
              class_id: acad.class_id,
              section_id: acad.section_id,
              roll_number: acad.roll_number || null,
              house_id: acad.house_id || null,
              joined_on: acad.joined_on,
              status: acad.status,
            })
            .eq("id", currentRecord.id);
          if (arErr) throw arErr;
        }
      }

      // Upload documents
      const updates: {
        photo_url?: string;
        birth_certificate_url?: string;
        aadhaar_copy_url?: string;
        transfer_certificate_url?: string;
      } = {};
      const uploadedDocs: { field: string; label: string; replaced: boolean }[] = [];
      const trackDoc = (field: keyof typeof updates, label: string, existing?: string | null) => {
        uploadedDocs.push({ field, label, replaced: Boolean(existing) });
      };
      if (photoFile) {
        updates.photo_url = await uploadStudentFile(form.scholar_number, "photos", photoFile);
        trackDoc("photo_url", "Student Photograph", student?.photo_url);
      }
      if (birthCertFile) {
        updates.birth_certificate_url = await uploadStudentFile(
          form.scholar_number,
          "documents",
          birthCertFile,
        );
        trackDoc("birth_certificate_url", "Birth Certificate", student?.birth_certificate_url);
      }
      if (aadhaarFile) {
        updates.aadhaar_copy_url = await uploadStudentFile(
          form.scholar_number,
          "documents",
          aadhaarFile,
        );
        trackDoc("aadhaar_copy_url", "Aadhaar Copy", student?.aadhaar_copy_url);
      }
      if (tcFile) {
        updates.transfer_certificate_url = await uploadStudentFile(
          form.scholar_number,
          "documents",
          tcFile,
        );
        trackDoc(
          "transfer_certificate_url",
          "Transfer Certificate",
          student?.transfer_certificate_url,
        );
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("students").update(updates).eq("id", studentId);
        if (error) throw error;
        for (const doc of uploadedDocs) {
          try {
            await logActivity({
              module: "Students",
              action: doc.replaced ? "Document Replaced" : "Document Uploaded",
              entityType: "student",
              entityId: studentId,
              details: {
                scholar_number: form.scholar_number,
                student_name: form.full_name,
                document: doc.label,
              },
            });
          } catch {
            /* ignore */
          }
        }
      }
      try {
        await logActivity({
          module: "Students",
          action: mode === "new" ? "Student Admitted" : "Student Updated",
          entityType: "student",
          entityId: studentId,
          details: { scholar_number: form.scholar_number, name: form.full_name },
        });
      } catch {
        /* ignore */
      }
      return studentId;
    },
    onSuccess: (id) => {
      toast.success(mode === "new" ? "Student admitted successfully" : "Student updated");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student", id] });
      onSaved?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setA = <K extends keyof typeof acad>(k: K, v: (typeof acad)[K]) =>
    setAcad((a) => ({ ...a, [k]: v }));

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 mb-6">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="ids">IDs & Demographics</TabsTrigger>
            <TabsTrigger value="parents">Parents & Guardian</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="docs">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Scholar Number *">
                <Input value={form.scholar_number} readOnly disabled />
              </Field>
              <Field label="Admission Type">
                <Select
                  value={form.admission_type}
                  onValueChange={(v) => set("admission_type", v as AdmissionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMISSION_TYPE_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Student Name *">
                <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
              </Field>
              <Field label="Gender">
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date of Birth">
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                />
              </Field>
              <Field label="Date of Admission *">
                <Input
                  type="date"
                  value={form.date_of_admission}
                  onChange={(e) => set("date_of_admission", e.target.value)}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="ids" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Aadhaar Number">
                <Input
                  value={form.aadhaar_number}
                  onChange={(e) => set("aadhaar_number", e.target.value)}
                />
              </Field>
              <Field label="APAAR ID">
                <Input value={form.apaar_id} onChange={(e) => set("apaar_id", e.target.value)} />
              </Field>
              <Field label="PEN ID">
                <Input value={form.pen_id} onChange={(e) => set("pen_id", e.target.value)} />
              </Field>
              <Field label="Samagra ID">
                <Input
                  value={form.samagra_id}
                  onChange={(e) => set("samagra_id", e.target.value)}
                />
              </Field>
              <Field label="Nationality">
                <Input
                  value={form.nationality}
                  onChange={(e) => set("nationality", e.target.value)}
                />
              </Field>
              <Field label="Religion">
                <Input value={form.religion} onChange={(e) => set("religion", e.target.value)} />
              </Field>
              <Field label="Category">
                <Input
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="General / OBC / SC / ST"
                />
              </Field>
              <Field label="Caste">
                <Input value={form.caste} onChange={(e) => set("caste", e.target.value)} />
              </Field>
              <Field label="Blood Group">
                <Input
                  value={form.blood_group}
                  onChange={(e) => set("blood_group", e.target.value)}
                />
              </Field>
              <Field label="Mother Tongue">
                <Input
                  value={form.mother_tongue}
                  onChange={(e) => set("mother_tongue", e.target.value)}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="parents" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Father's Name">
                <Input
                  value={form.father_name}
                  onChange={(e) => set("father_name", e.target.value)}
                />
              </Field>
              <Field label="Father's Mobile">
                <Input
                  value={form.father_mobile}
                  onChange={(e) => set("father_mobile", e.target.value)}
                />
              </Field>
              <Field label="Father's Occupation">
                <Input
                  value={form.father_occupation}
                  onChange={(e) => set("father_occupation", e.target.value)}
                />
              </Field>
              <Field label="Father's Email">
                <Input
                  type="email"
                  value={form.father_email}
                  onChange={(e) => set("father_email", e.target.value)}
                />
              </Field>
              <Field label="Mother's Name">
                <Input
                  value={form.mother_name}
                  onChange={(e) => set("mother_name", e.target.value)}
                />
              </Field>
              <Field label="Mother's Mobile">
                <Input
                  value={form.mother_mobile}
                  onChange={(e) => set("mother_mobile", e.target.value)}
                />
              </Field>
              <Field label="Mother's Occupation">
                <Input
                  value={form.mother_occupation}
                  onChange={(e) => set("mother_occupation", e.target.value)}
                />
              </Field>
              <Field label="Mother's Email">
                <Input
                  type="email"
                  value={form.mother_email}
                  onChange={(e) => set("mother_email", e.target.value)}
                />
              </Field>
              <Field label="Guardian Name">
                <Input
                  value={form.guardian_name}
                  onChange={(e) => set("guardian_name", e.target.value)}
                />
              </Field>
              <Field label="Guardian Mobile">
                <Input
                  value={form.guardian_phone}
                  onChange={(e) => set("guardian_phone", e.target.value)}
                />
              </Field>
              <Field label="Emergency Contact Name">
                <Input
                  value={form.emergency_contact_name}
                  onChange={(e) => set("emergency_contact_name", e.target.value)}
                />
              </Field>
              <Field label="Emergency Contact Number">
                <Input
                  value={form.emergency_contact_number}
                  onChange={(e) => set("emergency_contact_number", e.target.value)}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="address" className="space-y-4">
            <Field label="Address">
              <Textarea
                rows={3}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="City">
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
              </Field>
              <Field label="PIN Code">
                <Input value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="academic" className="space-y-4">
            {mode === "edit" && !currentRecord && (
              <p className="text-sm text-muted-foreground">
                This student has no academic record yet. Use Promote to create one.
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Academic Session *">
                <Select
                  value={acad.academic_session_id}
                  onValueChange={(v) => setA("academic_session_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.is_active ? " (active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Class *">
                <Select
                  value={acad.class_id}
                  onValueChange={(v) => {
                    setA("class_id", v);
                    setA("section_id", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={`Section${(sections?.length ?? 0) > 0 ? " *" : " (N/A)"}`}>
                <Select
                  value={acad.section_id || "none"}
                  onValueChange={(v) => setA("section_id", v === "none" ? "" : v)}
                  disabled={!acad.class_id || (sections?.length ?? 0) === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        (sections?.length ?? 0) === 0 ? "No sections configured" : "Select section"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(sections?.length ?? 0) === 0 && (
                      <SelectItem value="none">— Not Applicable —</SelectItem>
                    )}
                    {sections?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Roll Number">
                <Input
                  value={acad.roll_number}
                  onChange={(e) => setA("roll_number", e.target.value)}
                  placeholder="Auto-assigned; leave blank"
                />
              </Field>
              <Field label="House">
                <Select
                  value={acad.house_id || "none"}
                  onValueChange={(v) => setA("house_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {houses?.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Joined On">
                <Input
                  type="date"
                  value={acad.joined_on}
                  onChange={(e) => setA("joined_on", e.target.value)}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={acad.status}
                  onValueChange={(v) => setA("status", v as StudentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDENT_STATUS_VALUES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4">
            <FileField
              label="Student Photograph"
              accept="image/*"
              file={photoFile}
              setFile={setPhotoFile}
              existing={student?.photo_url}
            />
            <FileField
              label="Birth Certificate"
              file={birthCertFile}
              setFile={setBirthCertFile}
              existing={student?.birth_certificate_url}
            />
            <FileField
              label="Aadhaar Copy"
              file={aadhaarFile}
              setFile={setAadhaarFile}
              existing={student?.aadhaar_copy_url}
            />
            <FileField
              label="Transfer Certificate"
              file={tcFile}
              setFile={setTcFile}
              existing={student?.transfer_certificate_url}
            />
          </TabsContent>
        </Tabs>

        {mode === "new" && Object.keys(mandatoryErrors).length > 0 && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive mb-1">Complete the required fields:</p>
            <ul className="list-disc pl-5 text-destructive/90 space-y-0.5">
              {Object.entries(mandatoryErrors).map(([k, v]) => (
                <li key={k}>{v}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !canSubmit}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "new" ? "Admit Student" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FileField({
  label,
  accept,
  file,
  setFile,
  existing,
}: {
  label: string;
  accept?: string;
  file: File | null;
  setFile: (f: File | null) => void;
  existing?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {file ? (
        <p className="text-xs text-muted-foreground">Selected: {file.name}</p>
      ) : existing ? (
        <p className="text-xs text-muted-foreground">
          Existing file uploaded. Choose a new file to replace.
        </p>
      ) : null}
    </div>
  );
}
