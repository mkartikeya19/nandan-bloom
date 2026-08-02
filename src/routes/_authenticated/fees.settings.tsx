import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { FeesTabs } from "@/components/fees/fees-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";

export const Route = createFileRoute("/_authenticated/fees/settings")({
  component: FeeSettingsPage,
});

function FeeSettingsPage() {
  const qc = useQueryClient();
  const { canManageFeeStructures } = useUserRoles();
  const { data } = useQuery({
    queryKey: ["fee-settings"],
    queryFn: async () =>
      (await supabase.from("fee_settings").select("*").limit(1).maybeSingle()).data,
  });
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState(0);
  const [days, setDays] = useState(0);
  const [collectionMode, setCollectionMode] = useState<"auto" | "manual" | "ask">("auto");
  useEffect(() => {
    if (data) {
      setEnabled(data.late_fee_enabled);
      setAmount(Number(data.late_fee_amount));
      setDays(data.late_fee_grace_days);
      setCollectionMode(
        ((data as { default_collection_mode?: string }).default_collection_mode ?? "auto") as
          | "auto"
          | "manual"
          | "ask",
      );
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        late_fee_enabled: enabled,
        late_fee_amount: amount,
        late_fee_grace_days: days,
        default_collection_mode: collectionMode,
      };
      if (!data) {
        const { error } = await supabase.from("fee_settings").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_settings").update(payload).eq("id", data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["fee-settings"] });
      qc.invalidateQueries({ queryKey: ["fee-settings-mode"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="Fee Settings" description="Fee module configuration." />
      <FeesTabs />
      <div className="grid gap-4 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Default Collection Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Controls which allocation mode opens by default in Collect Payment.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={collectionMode === "auto" ? "default" : "outline"}
                disabled={!canManageFeeStructures}
                onClick={() => setCollectionMode("auto")}
              >
                Automatic (Quick Collect)
              </Button>
              <Button
                size="sm"
                variant={collectionMode === "manual" ? "default" : "outline"}
                disabled={!canManageFeeStructures}
                onClick={() => setCollectionMode("manual")}
              >
                Manual Allocation
              </Button>
              <Button
                size="sm"
                variant={collectionMode === "ask" ? "default" : "outline"}
                disabled={!canManageFeeStructures}
                onClick={() => setCollectionMode("ask")}
              >
                Ask Every Time
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Late Fee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Enable Late Fee</Label>
                <p className="text-xs text-muted-foreground">
                  Off by default. Calculations are future-ready and not applied in this sprint.
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={!canManageFeeStructures}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Late Fee Amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  disabled={!canManageFeeStructures || !enabled}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Grace Days</Label>
                <Input
                  type="number"
                  min={0}
                  value={days}
                  disabled={!canManageFeeStructures || !enabled}
                  onChange={(e) => setDays(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {canManageFeeStructures && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-fit">
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
