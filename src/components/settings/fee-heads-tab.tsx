import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { ReadOnlyNotice } from "./read-only-notice";
import { FEE_FREQUENCIES, MONTH_NAMES, DEFAULT_TUITION_MONTHS, type FeeFrequency } from "@/lib/fees-helpers";

type FeeHead = {
  id: string;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  default_amount: number;
  default_frequency: FeeFrequency;
  default_applicable_months: number[] | null;
  auto_generate: boolean;
  charge_trigger: "Automatic" | "Manual";
};

type FormState = {
  name: string;
  description: string;
  is_mandatory: boolean;
  default_amount: number;
  default_frequency: FeeFrequency;
  default_applicable_months: number[];
  auto_generate: boolean;
  charge_trigger: "Automatic" | "Manual";
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  is_mandatory: false,
  default_amount: 0,
  default_frequency: "Monthly",
  default_applicable_months: DEFAULT_TUITION_MONTHS,
  auto_generate: true,
  charge_trigger: "Automatic",
};

export function FeeHeadsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FeeHead | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["fee_heads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fee_heads").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as FeeHead[];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (f: FeeHead) => {
    setEditing(f);
    setForm({
      name: f.name,
      description: f.description ?? "",
      is_mandatory: f.is_mandatory,
      default_amount: Number(f.default_amount),
      default_frequency: f.default_frequency ?? "Monthly",
      default_applicable_months: f.default_applicable_months ?? [],
      auto_generate: f.auto_generate ?? true,
      charge_trigger: f.charge_trigger ?? "Automatic",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Fee head name is required");
      if (form.default_amount < 0) throw new Error("Amount must be non-negative");
      const isMonthlyLike = form.default_frequency === "Monthly" || form.default_frequency === "Quarterly";
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        is_mandatory: form.is_mandatory,
        default_amount: form.default_amount,
        default_frequency: form.default_frequency,
        default_applicable_months: isMonthlyLike ? form.default_applicable_months : null,
        auto_generate: form.auto_generate,
        charge_trigger: form.charge_trigger,
      };
      if (editing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("fee_heads").update(payload as any).eq("id", editing.id);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("fee_heads").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Fee head updated" : "Fee head created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["fee_heads"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "A fee head with that name already exists" : e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fee_heads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee head deleted");
      qc.invalidateQueries({ queryKey: ["fee_heads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  const toggleMonth = (m: number) => {
    setForm((prev) => ({
      ...prev,
      default_applicable_months: prev.default_applicable_months.includes(m)
        ? prev.default_applicable_months.filter((x) => x !== m)
        : [...prev.default_applicable_months, m].sort((a, b) => a - b),
    }));
  };

  const showMonths = form.default_frequency === "Monthly" || form.default_frequency === "Quarterly";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Fee Head Master</CardTitle>
          <CardDescription>
            Fee Heads define the <strong>rule</strong> (frequency, months, auto/manual, mandatory). Fee Structures define the{" "}
            <strong>amount</strong> per class/session. Schedules inherit rules from the head and amounts from the structure.
          </CardDescription>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> New fee head
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit fee head" : "New fee head"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tuition Fee" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default amount (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.default_amount}
                      onChange={(e) => setForm({ ...form, default_amount: Number(e.target.value) || 0 })}
                    />
                    <p className="text-xs text-muted-foreground">Suggested amount — overridden by the Fee Structure.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={form.default_frequency}
                      onValueChange={(v) => setForm({ ...form, default_frequency: v as FeeFrequency })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FEE_FREQUENCIES.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Charge Trigger</Label>
                    <Select
                      value={form.charge_trigger}
                      onValueChange={(v) => setForm({ ...form, charge_trigger: v as "Automatic" | "Manual" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Automatic">Automatic</SelectItem>
                        <SelectItem value="Manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Manual heads are not auto-added to schedules; they are billed on demand.
                    </p>
                  </div>
                </div>

                {showMonths && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label>Applicable Months</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {MONTH_NAMES.map((name, idx) => {
                        const m = idx + 1;
                        const checked = form.default_applicable_months.includes(m);
                        return (
                          <label key={m} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={checked} onCheckedChange={() => toggleMonth(m)} />
                            {name.slice(0, 3)}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label>Auto Generate</Label>
                      <p className="text-xs text-muted-foreground">Include when a student's fee schedule is generated.</p>
                    </div>
                    <Switch checked={form.auto_generate} onCheckedChange={(v) => setForm({ ...form, auto_generate: v })} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label>Mandatory</Label>
                      <p className="text-xs text-muted-foreground">Charged to every student by default.</p>
                    </div>
                    <Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {!canEdit && <ReadOnlyNotice />}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search fee heads..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Months</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead>Mandatory</TableHead>
                  <TableHead>Default (₹)</TableHead>
                  {canEdit && <TableHead className="w-[110px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 8 : 7} className="text-center text-sm text-muted-foreground py-8">
                      No fee heads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => {
                    const months = f.default_applicable_months ?? [];
                    const isMonthlyLike = f.default_frequency === "Monthly" || f.default_frequency === "Quarterly";
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell>{f.default_frequency}</TableCell>
                        <TableCell className="text-xs">
                          {isMonthlyLike
                            ? months.length === 12
                              ? "All"
                              : months.length
                                ? months.map((m) => MONTH_NAMES[m - 1].slice(0, 3)).join(", ")
                                : "—"
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.charge_trigger === "Manual" ? "secondary" : "default"}>
                            {f.charge_trigger}
                          </Badge>
                        </TableCell>
                        <TableCell>{f.auto_generate ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                        <TableCell>{f.is_mandatory ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}</TableCell>
                        <TableCell>₹ {Number(f.default_amount).toLocaleString("en-IN")}</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete fee head "{f.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => del.mutate(f.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
