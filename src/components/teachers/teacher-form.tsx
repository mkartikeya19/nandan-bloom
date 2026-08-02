import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { logActivity } from "@/lib/activity";
import { fetchNextEmployeeCode, TEACHER_STATUS_VALUES } from "@/lib/teachers-helpers";

export interface TeacherRecord {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  date_of_joining: string | null;
  qualification: string | null;
  subject_specialization: string | null;
  designation: string | null;
  address: string | null;
  aadhaar_number: string | null;
  pan_number: string | null;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  monthly_salary: number | null;
  salary_effective_from: string | null;
  total_experience_years: number | null;
  previous_school: string | null;
  status: string;
  is_archived: boolean;
}

type FormState = Record<string, string>;

const EMPTY: FormState = {
  employee_code: "",
  full_name: "",
  date_of_joining: "",
  phone: "",
  email: "",
  designation: "",
  qualification: "",
  subject_specialization: "",
  gender: "",
  date_of_birth: "",
  address: "",
  aadhaar_number: "",
  pan_number: "",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  ifsc_code: "",
  monthly_salary: "",
  salary_effective_from: "",
  total_experience_years: "",
  previous_school: "",
  status: "Active",
};

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  date_of_joining: z.string().min(1, "Date of joining is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  aadhaar_number: z
    .string()
    .trim()
    .regex(/^[0-9]{12}$/, "Aadhaar must be 12 digits")
    .optional()
    .or(z.literal("")),
  pan_number: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN format: ABCDE1234F")
    .optional()
    .or(z.literal("")),
  ifsc_code: z
    .string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC format: ABCD0123456")
    .optional()
    .or(z.literal("")),
});

function nullish(v: string) {
  const t = v.trim();
  return t === "" ? null : t;
}
function numOrNull(v: string) {
  const t = v.trim();
  return t === "" ? null : Number(t);
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teacher?: TeacherRecord | null;
}

export function TeacherForm({ open, onOpenChange, teacher }: Props) {
  const qc = useQueryClient();
  const isEdit = !!teacher;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (teacher) {
      setForm({
        ...EMPTY,
        ...Object.fromEntries(
          Object.keys(EMPTY).map((k) => {
            const v = (teacher as unknown as Record<string, unknown>)[k];
            return [k, v == null ? "" : String(v)];
          }),
        ),
      });
      setErrors({});
    } else {
      setForm(EMPTY);
      setErrors({});
      fetchNextEmployeeCode()
        .then((code) => setForm((f) => ({ ...f, employee_code: code })))
        .catch(() => toast.error("Could not generate an Employee ID"));
    }
  }, [open, teacher]);

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        const e: Record<string, string> = {};
        parsed.error.issues.forEach((i) => {
          e[String(i.path[0])] = i.message;
        });
        setErrors(e);
        throw new Error("Please fix the highlighted fields");
      }
      setErrors({});

      const payload = {
        full_name: form.full_name.trim(),
        date_of_joining: nullish(form.date_of_joining),
        phone: nullish(form.phone),
        email: nullish(form.email),
        designation: nullish(form.designation),
        qualification: nullish(form.qualification),
        subject_specialization: nullish(form.subject_specialization),
        gender: nullish(form.gender),
        date_of_birth: nullish(form.date_of_birth),
        address: nullish(form.address),
        aadhaar_number: nullish(form.aadhaar_number),
        pan_number: nullish(form.pan_number)?.toUpperCase() ?? null,
        bank_name: nullish(form.bank_name),
        account_holder_name: nullish(form.account_holder_name),
        account_number: nullish(form.account_number),
        ifsc_code: nullish(form.ifsc_code)?.toUpperCase() ?? null,
        monthly_salary: numOrNull(form.monthly_salary),
        salary_effective_from: nullish(form.salary_effective_from),
        total_experience_years: numOrNull(form.total_experience_years),
        previous_school: nullish(form.previous_school),
        status: form.status || "Active",
      };

      if (isEdit && teacher) {
        const { error } = await supabase.from("teachers").update(payload).eq("id", teacher.id);
        if (error) throw error;
        await logActivity({
          module: "Teachers",
          action: "Teacher Updated",
          entityType: "teacher",
          entityId: teacher.id,
          details: { employee_code: teacher.employee_code, full_name: payload.full_name },
        });
        return teacher.id;
      }

      const code = form.employee_code || (await fetchNextEmployeeCode());
      const { data, error } = await supabase
        .from("teachers")
        .insert({ ...payload, employee_code: code })
        .select("id")
        .single();
      if (error) throw error;
      await logActivity({
        module: "Teachers",
        action: "Teacher Created",
        entityType: "teacher",
        entityId: data.id,
        details: { employee_code: code, full_name: payload.full_name },
      });
      return data.id;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Teacher updated" : "Teacher created");
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["teacher"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (key: string, label: string, type = "text", required = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={key} type={type} value={form[key]} onChange={set(key)} />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit teacher" : "Add teacher"}</DialogTitle>
          <DialogDescription>
            Confidential employee master record. Visible to Super Admins only.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="ids">Government IDs</TabsTrigger>
            <TabsTrigger value="bank">Bank &amp; Salary</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-1 py-4">
            <TabsContent value="basic" className="mt-0 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input value={form.employee_code} readOnly className="font-mono bg-muted" />
                <p className="text-xs text-muted-foreground">
                  Auto-generated, permanent identifier.
                </p>
              </div>
              {field("full_name", "Full name", "text", true)}
              {field("date_of_joining", "Date of joining", "date", true)}
              {field("phone", "Mobile number", "tel", true)}
              {field("email", "Email")}
              {field("designation", "Designation")}
              {field("qualification", "Qualification")}
              {field("subject_specialization", "Subject specialisation")}
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                  value={form.gender}
                  onChange={set("gender")}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {field("date_of_birth", "Date of birth", "date")}
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                  value={form.status}
                  onChange={set("status")}
                >
                  {TEACHER_STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Inactive staff are excluded from future assignments.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={form.address} onChange={set("address")} rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="ids" className="mt-0 grid gap-4 sm:grid-cols-2">
              {field("aadhaar_number", "Aadhaar number")}
              {field("pan_number", "PAN number")}
            </TabsContent>

            <TabsContent value="bank" className="mt-0 grid gap-4 sm:grid-cols-2">
              {field("bank_name", "Bank name")}
              {field("account_holder_name", "Account holder name")}
              {field("account_number", "Account number")}
              {field("ifsc_code", "IFSC code")}
              {field("monthly_salary", "Monthly salary (₹)", "number")}
              {field("salary_effective_from", "Effective from", "date")}
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Salary is stored for future Payroll only — no calculations are performed in this
                release.
              </p>
            </TabsContent>

            <TabsContent value="experience" className="mt-0 grid gap-4 sm:grid-cols-2">
              {field("total_experience_years", "Total experience (years)", "number")}
              {field("previous_school", "Previous school (optional)")}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              !form.full_name.trim() ||
              !form.date_of_joining ||
              !form.phone.trim()
            }
          >
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create teacher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
