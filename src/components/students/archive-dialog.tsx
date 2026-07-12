import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  studentName: string;
  currentRecordId?: string | null;
}

export function ArchiveDialog({ open, onOpenChange, studentId, studentName, currentRecordId }: Props) {
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: async () => {
      if (!currentRecordId) {
        throw new Error("No active academic record to archive");
      }
      const { error } = await supabase
        .from("student_academic_records")
        .update({ status: "Inactive" })
        .eq("id", currentRecordId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student archived — academic record set to Inactive");
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["student", studentId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {studentName}?</AlertDialogTitle>
          <AlertDialogDescription>
            The student's profile and academic history are preserved. Their current academic record will be set to <strong>Inactive</strong>. You can re-activate them later by promoting to a new record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={() => archive.mutate()} disabled={archive.isPending}>Archive</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
