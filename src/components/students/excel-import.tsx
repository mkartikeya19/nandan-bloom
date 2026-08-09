import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle, FileDown } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  IMPORT_COLUMNS,
  downloadImportTemplate,
  parseWorkbook,
  cleanStr,
  STUDENT_STATUS_VALUES,
  type StudentStatus,
  type RawRow,
} from "@/lib/students-helpers";
import { normalizeSpreadsheetDate } from "@/lib/spreadsheet-date";
import {
  createMigrationBatch,
  recordBatchItems,
  type MigrationBatchItemInput,
} from "@/services/migration.service";

type ValidRow = {
  rowNumber: number;
  student: Record<string, unknown> & { scholar_number: string; full_name: string };
  academicRecord: {
    academic_session_id: string;
    class_id: string;
    section_id: string | null;
    house_id: string | null;
    roll_number: string | null;
    joined_on: string;
    status: StudentStatus;
  };
};

type InvalidRow = { rowNumber: number; scholarNumber: string; name: string; errors: string[] };

export function ExcelImport({ batchType }: { batchType?: "students" } = {}) {
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [valid, setValid] = useState<ValidRow[]>([]);
  const [invalid, setInvalid] = useState<InvalidRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [summary, setSummary] = useState<{
    imported: number;
    highest: string;
    next: string;
    duplicates: number;
    skipped: number;
  } | null>(null);

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
      const { rows, date1904 } = await parseWorkbook(file);
      const seenScholars = new Set<string>();
      const v: ValidRow[] = [];
      const inv: InvalidRow[] = [];

      rows.forEach((r: RawRow, idx: number) => {
        const errors: string[] = [];
        const rowNumber = idx + 2;
        const scholar = cleanStr(r["Scholar Number"]);
        const name = cleanStr(r["Full Name"]);

        // Dates are normalised once, here, and the normalised values are what
        // get imported — validation and import can never disagree.
        const readDate = (column: string, label: string): string | null => {
          const res = normalizeSpreadsheetDate(r[column], { date1904 });
          if (!res.ok) {
            errors.push(`${label} is not a valid date ("${res.raw}")`);
            return null;
          }
          return res.value;
        };

        const doa = readDate("Date of Admission (YYYY-MM-DD)", "Date of Admission");
        const dob = readDate("Date of Birth (YYYY-MM-DD)", "Date of Birth");
        const joinedOnRaw = readDate("Joined On (YYYY-MM-DD)", "Joined On");
        const sessionName = cleanStr(r["Academic Session"]);
        const className = cleanStr(r["Class"]);
        const sectionName = cleanStr(r["Section"]);
        const houseName = cleanStr(r["House"]);
        const joinedOn = joinedOnRaw ?? doa ?? new Date().toISOString().slice(0, 10);

        if (!scholar) errors.push("Missing Scholar Number");
        if (!name) errors.push("Missing Full Name");
        if (!sessionName) errors.push("Missing Academic Session");
        if (!className) errors.push("Missing Class");

        if (scholar && refs.existingScholars.has(scholar))
          errors.push(`Scholar Number ${scholar} already exists in system`);
        if (scholar && seenScholars.has(scholar))
          errors.push(`Duplicate Scholar Number ${scholar} in file`);
        if (scholar) seenScholars.add(scholar);

        const session = refs.sessions.find((s) => s.name === sessionName);
        if (sessionName && !session) errors.push(`Session "${sessionName}" not found`);

        const cls = session
          ? refs.classes.find((c) => c.name === className && c.session_id === session.id)
          : undefined;
        if (className && !cls) errors.push(`Class "${className}" not found in session`);

        // Section is optional; when supplied it must belong to the class.
        const sec = cls
          ? refs.sections.find((s) => s.name === sectionName && s.class_id === cls.id)
          : undefined;
        if (sectionName && !sec) errors.push(`Section "${sectionName}" not found in class`);

        const house = houseName ? refs.houses.find((h) => h.name === houseName) : undefined;
        if (houseName && !house) errors.push(`House "${houseName}" not found`);

        const rawStatus = cleanStr(r["Status"]) ?? "Active";
        const status = STUDENT_STATUS_VALUES.includes(rawStatus as never) ? rawStatus : "Active";

        if (errors.length > 0 || !session || !cls || !scholar || !name) {
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
            date_of_birth: dob,
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
            section_id: sec?.id ?? null,
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

  function exportErrorReport() {
    if (invalid.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      invalid.map((r) => ({
        Row: r.rowNumber,
        "Scholar Number": r.scholarNumber,
        "Full Name": r.name,
        Errors: r.errors.join("; "),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `student-import-errors-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const doImport = useMutation({
    mutationFn: async () => {
      let ok = 0;
      const items: MigrationBatchItemInput[] = [];
      for (const row of valid) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc("admit_student_with_fee_structure", {
          _student_payload: row.student,
          _academic_payload: row.academicRecord,
        });
        if (error) throw error;
        const result = (data ?? {}) as { student_id?: string; academic_record_id?: string };
        if (result.student_id)
          items.push({
            entity_type: "student",
            entity_id: result.student_id,
            entity_label: String(row.student.scholar_number),
          });
        if (result.academic_record_id)
          items.push({
            entity_type: "student_academic_record",
            entity_id: result.academic_record_id,
            entity_label: String(row.student.scholar_number),
          });
        ok += 1;
      }
      if (batchType && items.length > 0) {
        const batchId = await createMigrationBatch(batchType, `Student import — ${ok} student(s)`);
        if (batchId) await recordBatchItems(batchId, items);
      }
      return ok;
    },

    onSuccess: async (count) => {
      toast.success(`Imported ${count} student(s)`);
      setImported(count);
      qc.invalidateQueries({ queryKey: ["students"] });
      // Fetch highest & next scholar
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: nextData } = await (supabase as any).rpc("next_scholar_number");
      const next = String(nextData ?? "");
      const highest = next ? String(Number(next) - 1) : "—";
      const duplicates = invalid.filter((r) =>
        r.errors.some((e) => e.toLowerCase().includes("scholar number")),
      ).length;
      setSummary({
        imported: count,
        highest,
        next,
        duplicates,
        skipped: invalid.length,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {summary && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Import Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <SummaryStat label="Students Imported" value={summary.imported} />
            <SummaryStat label="Highest Scholar No." value={summary.highest} />
            <SummaryStat label="Next Scholar No." value={summary.next} />
            <SummaryStat label="Duplicates" value={summary.duplicates} />
            <SummaryStat label="Skipped Rows" value={summary.skipped} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Download the template</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={downloadImportTemplate}>
            <Download className="h-4 w-4" /> Download Excel template
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            The template has {IMPORT_COLUMNS.length} columns. Values for Academic Session, Class,
            Section, and House must match existing entries in Settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Upload &amp; validate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button onClick={handleValidate} disabled={!file || validating}>
              {validating && <Loader2 className="h-4 w-4 animate-spin" />}
              Validate
            </Button>
          </div>
          {(valid.length > 0 || invalid.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {valid.length} valid
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> {invalid.length} invalid
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {invalid.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Invalid rows (will be skipped)</CardTitle>
            <Button variant="outline" size="sm" onClick={exportErrorReport}>
              <FileDown className="h-4 w-4" /> Export error report
            </Button>
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
                    <TableCell className="text-destructive text-sm">
                      {r.errors.join("; ")}
                    </TableCell>
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
            <Button
              onClick={() => doImport.mutate()}
              disabled={doImport.isPending || imported !== null}
            >
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
                    <TableCell className="font-mono text-xs">
                      {String(r.student.scholar_number)}
                    </TableCell>
                    <TableCell>{String(r.student.full_name)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {valid.length > 50 && (
              <p className="text-xs text-muted-foreground p-3">
                Showing first 50 of {valid.length} valid rows.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
