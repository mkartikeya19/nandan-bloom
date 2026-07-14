import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { STUDENT_STATUS_VALUES, type StudentStatus } from "@/lib/students-helpers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
  currentRecordId?: string | null;
}

export function PromoteDialog({ open, onOpenChange, studentId, studentName, currentRecordId }: Props) {
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [houseId, setHouseId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [joinedOn, setJoinedOn] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<StudentStatus>("Active");

  const { data: sessions } = useQuery({
    queryKey: ["ref-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("academic_sessions").select("id, name, is_active").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: classes } = useQuery({
    queryKey: ["ref-classes", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.from("school_classes").select("id, name, order_index").eq("session_id", sessionId).order("order_index");
      if (error) throw error;
      return data;
    },
  });
  const { data: sections } = useQuery({
    queryKey: ["ref-sections", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("school_sections").select("id, name").eq("class_id", classId).order("name");
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

  const promote = useMutation({
    mutationFn: async () => {
      if (!sessionId || !classId || !sectionId) throw new Error("Session, class, and section are required");
      let feeStructureId: string | null = null;
      if (status === "Active") {
        const { data: matches, error: matchErr } = await supabase
          .from("fee_structures")
          .select("id, fee_structure_items!inner(id)")
          .eq("academic_session_id", sessionId)
          .eq("class_id", classId)
          .eq("is_active", true);
        if (matchErr) throw matchErr;
        if (!matches?.length) {
          throw new Error("No Complete Fee Structure exists for this class and session. Please complete a Fee Structure before admitting the student.");
        }
        if (matches.length > 1) {
          throw new Error("Multiple active Fee Structures found. Please resolve the duplicate before admitting students.");
        }
        feeStructureId = matches[0].id;
      }
      const { error } = await supabase.from("student_academic_records").insert({
        student_id: studentId,
        academic_session_id: sessionId,
        class_id: classId,
        section_id: sectionId,
        house_id: houseId || null,
        roll_number: rollNumber || null,
        joined_on: joinedOn,
        status,
        fee_structure_id: feeStructureId,
        promoted_from_record_id: currentRecordId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promotion recorded");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Promote {studentName}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Academic Session *</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
              <SelectContent>
                {sessions?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.is_active ? " (active)" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Class *</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Section *</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
              <SelectContent>
                {sections?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>House</Label>
            <Select value={houseId || "none"} onValueChange={(v) => setHouseId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {houses?.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Roll Number</Label>
            <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Joined On</Label>
            <Input type="date" value={joinedOn} onChange={(e) => setJoinedOn(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StudentStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STUDENT_STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          A new academic record will be created. Previous records are preserved and unchanged.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => promote.mutate()} disabled={promote.isPending}>
            {promote.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
