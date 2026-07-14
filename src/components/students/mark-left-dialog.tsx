import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { logActivity } from "@/lib/activity";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
  currentRecordId?: string | null;
}

export function MarkLeftDialog({ open, onOpenChange, studentId, studentName, currentRecordId }: Props) {
  const qc = useQueryClient();
  const [dateOfLeaving, setDateOfLeaving] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!dateOfLeaving) throw new Error("Date of Leaving is required");
      const { error } = await supabase
        .from("students")
        .update({
          status: "Left",
          date_of_leaving: dateOfLeaving,
          reason_for_leaving: reason || null,
        })
        .eq("id", studentId);
      if (error) throw error;
      if (currentRecordId) {
        const { error: e2 } = await supabase
          .from("student_academic_records")
          .update({ status: "Left" })
          .eq("id", currentRecordId);
        if (e2) throw e2;
      }
      await logActivity({
        module: "Students",
        action: "Marked as Left",
        entityType: "student",
        entityId: studentId,
        details: { date_of_leaving: dateOfLeaving, reason },
      });
    },
    onSuccess: () => {
      toast.success(`${studentName} marked as Left`);
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {studentName} as Left</DialogTitle>
          <DialogDescription>
            The student will remain searchable with complete history, but will not appear in Attendance, Fee Collection or Promotion.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Date of Leaving *</Label>
            <Input type="date" value={dateOfLeaving} onChange={(e) => setDateOfLeaving(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason for Leaving (optional)</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Transferred, family relocation…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Mark as Left
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
