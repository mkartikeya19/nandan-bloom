import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  IMPORT_COLUMNS,
  downloadImportTemplate,
  parseWorkbook,
  cleanStr,
  STUDENT_STATUS_VALUES,
  type StudentStatus,
  type RawRow,
} from "@/lib/students-helpers";

type ValidRow = {
  rowNumber: number;
  student: Record<string, unknown> & { scholar_number: string; full_name: string };
  academicRecord: {
    academic_session_id: string;
    class_id: string;
    section_id: string;
    house_id: string | null;
    roll_number: string | null;
    joined_on: string;
    status: StudentStatus;
  };
};

type InvalidRow = { rowNumber: number; scholarNumber: string; name: string; errors: string[] };

export function ExcelImport() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [valid, setValid] = useState<ValidRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const { data: refs } = useQuery({
    queryKey: ["import-refs"],
    queryFn: async () => {
      const [ses, cls, sec, hs, stu] = await Promise.all([
        supabase.from("academic_sessions").select("id, name"),
        supabase.from("school_classes").select("id, name, session_id"),
        supabase.from("school_sections").select("id, name, class_id"),
        supabase.from("houses").select("id, name"),
        supabase.from("students").select("scholar_number"),
      ]);
      return {
        sessions: ses.data ?? [],
        classes: cls.data ?? [],
        sections: sec.data ?? [],
        houses: hs.data ?? [],
        existingScholars: new Set((stu.data ?? []).map((s) => s.scholar_number)),
      };
    },
  });

  async function handleValidate() {
    if (!file || !refs) return;
    setValidating(true);
    setImported(null);
    try {
      const rows = await parseWorkbook(file);
      const seenScholars = new Set<string>();
      const v: ValidRow[] = [];
      const inv: InvalidRow[] = [];

      rows.forEach((r: RawRow, idx: number) => {
        const errors: string[] = [];
        const rowNumber = idx + 2;
        const scholar = cleanStr(r["Scholar Number"]);
        const name = cleanStr(r["Full Name"]);
        const doa = cleanStr(r["Date of Admission (YYYY-MM-DD)"]);
        const sessionName = cleanStr(r["Academic Session"]);
        const className = cleanStr(r["Class"]);
        const sectionName = cleanStr(r["Section"]);
        const houseName = cleanStr(r["House"]);
        const joinedOn = cleanStr(r["Joined On (YYYY-MM-DD)"]) ?? doa ?? new Date().toISOString().slice(0, 10);

        if (!scholar) errors.push("Missing Scholar Number");
        if (!name) errors.push("Missing Full Name");
        if (!doa) errors.push("Missing Date of Admission");
        if (!sessionName) errors.push("Missing Academic Session");
        if (!className) errors.push("Missing Class");
        if (!sectionName) errors.push("Missing Section");

        if (scholar && refs.existingScholars.has(scholar))
          errors.push(`Scholar Number ${scholar} already exists in system`);
        if (scholar && seenScholars.has(scholar))
          errors.push(`Duplicate Scholar Number ${scholar} in file`);
        if (scholar) seenScholars.add(scholar);

        const session = refs.sessions.find((s) => s.name === sessionName);
        if (sessionName && !session) errors.push(`Session "${sessionName}" not found`);

        const cls = session ? refs.classes.find((c) => c.name === className && c.session_id === session.id) : undefined;
        if (className && !cls) errors.push(`Class "${className}" not found in session`);

        const sec = cls ? refs.sections.find((s) => s.name === sectionName && s.class_id === cls.id) : undefined;
        if (sectionName && !sec) errors.push(`Section "${sectionName}" not found in class`);

        const house = houseName ? refs.houses.find((h) => h.name === houseName) : undefined;
        if (houseName && !house) errors.push(`House "${houseName}" not found`);

        const rawStatus = cleanStr(r["Status"]) ?? "Active";
        const status = STUDENT_STATUS_VALUES.includes(rawStatus as never) ? rawStatus : "Active";

        if (errors.length > 0 || !session || !cls || !sec || !scholar || !name || !doa) {
          inv.push({ rowNumber, scholarNumber: scholar ?? "", name: name ?? "", errors });
          return;
        }

        v.push({
          rowNumber,
          student: {
            scholar_number: scholar,
            admission_number: scholar,
            full_name: name,
            admission_type: "Existing Student Migration",
            gender: cleanStr(r["Gender"]),
            date_of_birth: cleanStr(r["Date of Birth (YYYY-MM-DD)"]),
            date_of_admission: doa,
            aadhaar_number: cleanStr(r["Aadhaar Number"]),
            apaar_id: cleanStr(r["APAAR ID"]),
            pen_id: cleanStr(r["PEN ID"]),
            samagra_id: cleanStr(r["Samagra ID"]),
            nationality: cleanStr(r["Nationality"]),
            religion: cleanStr(r["Religion"]),
            category: cleanStr(r["Category"]),
            caste: cleanStr(r["Caste"]),
            blood_group: cleanStr(r["Blood Group"]),
            mother_tongue: cleanStr(r["Mother Tongue"]),
            father_name: cleanStr(r["Father Name"]),
            father_mobile: cleanStr(r["Father Mobile"]),
            father_occupation: cleanStr(r["Father Occupation"]),
            father_email: cleanStr(r["Father Email"]),
            mother_name: cleanStr(r["Mother Name"]),
            mother_mobile: cleanStr(r["Mother Mobile"]),
            mother_occupation: cleanStr(r["Mother Occupation"]),
            mother_email: cleanStr(r["Mother Email"]),
            guardian_name: cleanStr(r["Guardian Name"]),
            guardian_phone: cleanStr(r["Guardian Mobile"]),
            emergency_contact_name: cleanStr(r["Emergency Contact Name"]),
            emergency_contact_number: cleanStr(r["Emergency Contact Number"]),
            address: cleanStr(r["Address"]),
            city: cleanStr(r["City"]),
            state: cleanStr(r["State"]),
            pincode: cleanStr(r["PIN Code"]),
          },
          academicRecord: {
            academic_session_id: session.id,
            class_id: cls.id,
            section_id: sec.id,
            house_id: house?.id ?? null,
            roll_number: cleanStr(r["Roll Number"]),
            joined_on: joinedOn,
            status: status as StudentStatus,
          },
        });
      });

      setValid(v);
      setInvalid(inv);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setValidating(false);
    }
  }

  const doImport = useMutation({
    mutationFn: async () => {
      let ok = 0;
      for (const row of valid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await supabase.from("students").insert(row.student as any).select("id").single();
        if (error) throw error;
        const { error: arErr } = await supabase.from("student_academic_records").insert({
          student_id: data.id,
          ...row.academicRecord,
        });
        if (arErr) throw arErr;
        ok += 1;
      }
      return ok;
    },
    onSuccess: (count) => {
      toast.success(`Imported ${count} student(s)`);
      setImported(count);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Download the template</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadImportTemplate}>
            <Download className="h-4 w-4" /> Download Excel template
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            The template has {IMPORT_COLUMNS.length} columns. Values for Academic Session, Class, Section, and House must match existing entries in Settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Upload &amp; validate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button onClick={handleValidate} disabled={!file || validating}>
              {validating && <Loader2 className="h-4 w-4 animate-spin" />}
              Validate
            </Button>
          </div>
          {(valid.length > 0 || invalid.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {valid.length} valid</Badge>
              <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> {invalid.length} invalid</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {invalid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invalid rows (will be skipped)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Scholar No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invalid.map((r) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell>{r.rowNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{r.scholarNumber || "—"}</TableCell>
                    <TableCell>{r.name || "—"}</TableCell>
                    <TableCell className="text-destructive text-sm">{r.errors.join("; ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {valid.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Step 3 — Import valid rows</CardTitle>
            <Button onClick={() => doImport.mutate()} disabled={doImport.isPending || imported !== null}>
              {doImport.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Upload className="h-4 w-4" />
              {imported !== null ? `Imported ${imported}` : `Import ${valid.length} row(s)`}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Scholar No.</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valid.slice(0, 50).map((r) => (
                  <TableRow key={r.rowNumber}>
                    <TableCell>{r.rowNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{String(r.student.scholar_number)}</TableCell>
                    <TableCell>{String(r.student.full_name)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {valid.length > 50 && (
              <p className="text-xs text-muted-foreground p-3">Showing first 50 of {valid.length} valid rows.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
