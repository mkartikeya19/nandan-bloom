import { resolveNextClass } from "@/lib/promotion-helpers";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/_authenticated/students/promote")({
  component: PromotionWizardPage,
  head: () => ({ meta: [{ title: "Promotion Wizard — School ERP" }] }),
});

type StudentRow = {
  student_id: string;
  scholar_number: string;
  full_name: string;
  previous_record_id: string;
  current_class_id: string;
  current_section_id: string;
  current_house_id: string | null;
  current_roll_number: string | null;
  action: "promote" | "retain";
  new_class_id: string;
  new_section_id: string;
  new_house_id: string;
  new_roll_number: string;
  fee_structure_id: string;
};

function PromotionWizardPage() {
  const nav = useNavigate();
  const perms = useUserRoles();
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [settings, setSettings] = useState({
    copyHouses: true,
    copyRollNumbers: true,
    generateSchedule: true,
    applyFeeAuto: true,
  });
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [newSessionId, setNewSessionId] = useState("");
  const [currentClassId, setCurrentClassId] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: sessions } = useQuery({
    queryKey: ["promote-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_sessions")
        .select("id, name, status, is_active")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: currentClasses } = useQuery({
    queryKey: ["promote-current-classes", currentSessionId],
    enabled: !!currentSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_classes")
        .select("id, name, order_index")
        .eq("session_id", currentSessionId)
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: newClasses } = useQuery({
    queryKey: ["promote-new-classes", newSessionId],
    enabled: !!newSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_classes")
        .select("id, name, order_index")
        .eq("session_id", newSessionId)
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: newSections } = useQuery({
    queryKey: ["promote-new-sections", newSessionId],
    enabled: !!newSessionId,
    queryFn: async () => {
      const { data: cls } = await supabase
        .from("school_classes")
        .select("id")
        .eq("session_id", newSessionId);
      const classIds = (cls ?? []).map((c) => c.id);
      if (classIds.length === 0) return [];
      const { data, error } = await supabase
        .from("school_sections")
        .select("id, name, class_id")
        .in("class_id", classIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: feeStructures } = useQuery({
    queryKey: ["promote-fee-structures", newSessionId],
    enabled: !!newSessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_structures")
        .select("id, name, class_id, academic_session_id, fee_structure_items(amount)")
        .eq("academic_session_id", newSessionId);
      if (error) throw error;
      // Only structures that have at least one configured amount (Complete) can be assigned
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).filter((s) =>
        (s.fee_structure_items ?? []).some(
          (i: { amount: number | string }) => Number(i.amount) > 0,
        ),
      );
    },
  });

  const { data: houses } = useQuery({
    queryKey: ["promote-houses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const loadStudents = useMutation({
    mutationFn: async () => {
      if (!currentSessionId || !currentClassId || !newSessionId)
        throw new Error("Select all selections first");
      const { data, error } = await supabase
        .from("student_academic_records")
        .select(
          "id, student_id, class_id, section_id, house_id, roll_number, students!inner(id, scholar_number, full_name, status)",
        )
        .eq("academic_session_id", currentSessionId)
        .eq("class_id", currentClassId)
        .eq("status", "Active");
      if (error) throw error;
      type PromotionSource = {
        id: string;
        student_id: string;
        class_id: string;
        section_id: string;
        house_id: string | null;
        roll_number: string | null;
        students: { scholar_number: string; full_name: string; status: string };
      };
      const filtered = ((data ?? []) as unknown as PromotionSource[]).filter(
        (r) => r.students?.status !== "Left",
      );

      // Destination class comes from the shared promotion helper (unit tested).
      const cur = currentClasses?.find((c) => c.id === currentClassId);
      const nextClass = resolveNextClass(cur, newClasses ?? []);

      const built: StudentRow[] = filtered.map((r) => {
        const promoteClass = nextClass?.id ?? "";
        const structure = feeStructures?.find((f) => f.class_id === promoteClass);
        return {
          student_id: r.student_id,
          scholar_number: r.students.scholar_number,
          full_name: r.students.full_name,
          previous_record_id: r.id,
          current_class_id: r.class_id,
          current_section_id: r.section_id,
          current_house_id: r.house_id,
          current_roll_number: r.roll_number,
          action: "promote",
          new_class_id: promoteClass,
          new_section_id: "",
          new_house_id: settings.copyHouses ? (r.house_id ?? "") : "",
          new_roll_number: settings.copyRollNumbers ? (r.roll_number ?? "") : "",
          fee_structure_id: settings.applyFeeAuto ? (structure?.id ?? "") : "",
        };
      });
      setRows(built);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRow = (idx: number, patch: Partial<StudentRow>) => {
    setRows((r) => {
      const next = r.slice();
      next[idx] = { ...next[idx], ...patch };
      // if action changes, adjust new_class_id
      if (patch.action === "retain") next[idx].new_class_id = next[idx].current_class_id;
      if (patch.action === "promote") {
        const cur = currentClasses?.find((c) => c.id === next[idx].current_class_id);
        next[idx].new_class_id = resolveNextClass(cur, newClasses ?? [])?.id ?? "";
      }
      // auto-assign fee structure
      if (settings.applyFeeAuto) {
        const s = feeStructures?.find((f) => f.class_id === next[idx].new_class_id);
        if (s) next[idx].fee_structure_id = s.id;
      }
      return next;
    });
  };

  const preview = useMemo(() => {
    const promoted = rows.filter((r) => r.action === "promote").length;
    const retained = rows.filter((r) => r.action === "retain").length;
    const schedules = rows.filter((r) => r.fee_structure_id && settings.generateSchedule).length;
    return { promoted, retained, total: rows.length, schedules };
  }, [rows, settings.generateSchedule]);

  const execute = useMutation({
    mutationFn: async () => {
      const items = rows.map((r) => ({
        student_id: r.student_id,
        previous_record_id: r.previous_record_id,
        new_session_id: newSessionId,
        new_class_id: r.new_class_id,
        new_section_id: r.new_section_id,
        new_house_id: r.new_house_id,
        // RC-1: Roll numbers are NOT carried forward. They are regenerated
        // alphabetically per class immediately after the bulk insert below.
        new_roll_number: null,
        fee_structure_id: r.fee_structure_id,
        action: r.action,
        generate_schedule: settings.generateSchedule,
        joined_on: new Date().toISOString().slice(0, 10),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("bulk_promote_students", {
        _payload: { items },
      });
      if (error) throw error;
      // Regenerate roll numbers alphabetically for every class touched.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rolls } = await (supabase as any).rpc(
        "regenerate_roll_numbers_after_promotion",
        { _payload: { items } },
      );
      await logActivity({
        module: "Promotion",
        action: "Bulk Promotion Executed",
        details: {
          ...data,
          roll_numbers_assigned: rolls ?? 0,
          current_session: currentSessionId,
          new_session: newSessionId,
          class: currentClassId,
        },
      });
      return { ...data, roll_numbers_assigned: rolls ?? 0 } as {
        promoted: number;
        retained: number;
        schedules_created: number;
        roll_numbers_assigned: number;
      };
    },
    onSuccess: (data) => {
      toast.success(
        `Promoted ${data.promoted}, Retained ${data.retained}. ${data.schedules_created} fee rows created. Roll numbers regenerated for ${data.roll_numbers_assigned} students.`,
      );
      setPreviewOpen(false);
      nav({ to: "/students" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!perms.isLoading && !(perms.isAdmin || perms.isPrincipal)) {
    return (
      <div>
        <PageHeader
          title="Promotion Wizard"
          description="You do not have permission to run bulk promotions."
        />
      </div>
    );
  }

  const closedSelected = sessions?.find((s) => s.id === newSessionId)?.status === "Closed";

  return (
    <div>
      <PageHeader
        title="Bulk Promotion Wizard"
        description="Promote or retain the active students of a class in a single transaction."
        actions={
          <Button variant="outline" asChild>
            <Link to="/students">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </Button>
        }
      />

      {/* Step 0 — Settings */}
      {step === 0 && (
        <Card>
          <CardContent className="p-6 space-y-4 max-w-lg">
            <p className="font-medium">Promotion Settings</p>
            <ToggleRow
              label="Copy Houses"
              checked={settings.copyHouses}
              onChange={(v) => setSettings((s) => ({ ...s, copyHouses: v }))}
            />
            <ToggleRow
              label="Copy Roll Numbers"
              checked={settings.copyRollNumbers}
              onChange={(v) => setSettings((s) => ({ ...s, copyRollNumbers: v }))}
            />
            <ToggleRow
              label="Generate Fee Schedule"
              checked={settings.generateSchedule}
              onChange={(v) => setSettings((s) => ({ ...s, generateSchedule: v }))}
            />
            <ToggleRow
              label="Apply Fee Structure Automatically"
              checked={settings.applyFeeAuto}
              onChange={(v) => setSettings((s) => ({ ...s, applyFeeAuto: v }))}
            />
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(1)}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1 — Sessions */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4 max-w-lg">
            <p className="font-medium">Select Sessions</p>
            <div className="space-y-1.5">
              <Label>Current Session *</Label>
              <Select value={currentSessionId} onValueChange={setCurrentSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select current session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>New Session *</Label>
              <Select value={newSessionId} onValueChange={setNewSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions
                    ?.filter((s) => s.status !== "Closed")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {closedSelected && (
                <p className="text-xs text-destructive">
                  Closed sessions cannot receive promotions.
                </p>
              )}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!currentSessionId || !newSessionId || closedSelected}
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Class */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-4 max-w-lg">
            <p className="font-medium">Select Class</p>
            <div className="space-y-1.5">
              <Label>Class in Current Session *</Label>
              <Select value={currentClassId} onValueChange={setCurrentClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {(currentClasses?.length ?? 0) === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground">
                      No classes found for this session.
                    </div>
                  ) : (
                    currentClasses!.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {(newClasses?.length ?? 0) === 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                The destination session has no classes yet. Create classes for the new session under
                Settings → Classes before running promotion.
              </div>
            )}
            {(newClasses?.length ?? 0) > 0 && (feeStructures?.length ?? 0) === 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                No Complete Fee Structures exist for the destination session. Configure at least one
                Fee Structure with amounts before promotion.
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => {
                  setStep(3);
                  loadStudents.mutate();
                }}
                disabled={!currentClassId || (newClasses?.length ?? 0) === 0}
              >
                Load Students <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Roster */}
      {step === 3 && (
        <Card>
          <CardContent className="p-0">
            {loadStudents.isPending ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading students…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No active students found for this class.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scholar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>New Class</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>House</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Fee Structure</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={r.student_id}>
                      <TableCell className="font-mono text-xs">{r.scholar_number}</TableCell>
                      <TableCell>{r.full_name}</TableCell>
                      <TableCell>
                        <Select
                          value={r.action}
                          onValueChange={(v) =>
                            updateRow(idx, { action: v as "promote" | "retain" })
                          }
                        >
                          <SelectTrigger className="h-8 w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="promote">Promote</SelectItem>
                            <SelectItem value="retain">Retain</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.new_class_id}
                          onValueChange={(v) =>
                            updateRow(idx, { new_class_id: v, new_section_id: "" })
                          }
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(newClasses?.length ?? 0) === 0 ? (
                              <div className="p-2 text-xs text-muted-foreground">
                                No classes in destination session
                              </div>
                            ) : (
                              newClasses!.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.new_section_id}
                          onValueChange={(v) => updateRow(idx, { new_section_id: v })}
                        >
                          <SelectTrigger className="h-8 w-[100px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const opts = (newSections ?? []).filter(
                                (s) => s.class_id === r.new_class_id,
                              );
                              if (opts.length === 0)
                                return (
                                  <div className="p-2 text-xs text-muted-foreground">
                                    {r.new_class_id
                                      ? "No sections for this class"
                                      : "Pick a class first"}
                                  </div>
                                );
                              return opts.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.new_house_id || "none"}
                          onValueChange={(v) =>
                            updateRow(idx, { new_house_id: v === "none" ? "" : v })
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {houses?.map((h) => (
                              <SelectItem key={h.id} value={h.id}>
                                {h.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-[80px]"
                          value={r.new_roll_number}
                          onChange={(e) => updateRow(idx, { new_roll_number: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.fee_structure_id || "none"}
                          onValueChange={(v) =>
                            updateRow(idx, { fee_structure_id: v === "none" ? "" : v })
                          }
                        >
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {(() => {
                              const opts = (feeStructures ?? []).filter(
                                (f) => f.class_id === r.new_class_id,
                              );
                              if (opts.length === 0)
                                return (
                                  <div className="p-2 text-xs text-muted-foreground">
                                    {r.new_class_id
                                      ? "No Complete Fee Structures for this class"
                                      : "Pick a class first"}
                                  </div>
                                );
                              return opts.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="p-4 flex justify-between border-t">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={() => setPreviewOpen(true)}
                disabled={
                  rows.length === 0 ||
                  rows.some(
                    (r) =>
                      !r.new_class_id ||
                      !r.new_section_id ||
                      (r.action === "promote" && !r.fee_structure_id),
                  )
                }
              >
                Preview & Confirm <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Promotion</DialogTitle>
            <DialogDescription>
              Review before executing. Previous academic records are preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Row k="Students Promoted" v={preview.promoted} />
            <Row k="Students Retained" v={preview.retained} />
            <Row k="Students Excluded (Left)" v="Auto-excluded from load" />
            <Row k="Academic Records to Create" v={preview.total} />
            <Row k="Fee Schedules to Generate" v={preview.schedules} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => execute.mutate()} disabled={execute.isPending}>
              {execute.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Execute Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border rounded-md p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <Badge variant="secondary">{v}</Badge>
    </div>
  );
}
