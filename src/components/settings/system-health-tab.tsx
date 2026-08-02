import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CountableTable = keyof Database["public"]["Tables"];

async function count(table: CountableTable, filter?: { column: string; value: string }) {
  const base = supabase.from(table).select("*", { count: "exact", head: true });
  const { count: n, error } = await (filter ? base.eq(filter.column, filter.value) : base);
  if (error) return -1;
  return n ?? 0;
}

export function SystemHealthTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const [
        sessions,
        activeSessions,
        classes,
        sections,
        houses,
        feeHeads,
        feeStructures,
        students,
        teachers,
        profile,
      ] = await Promise.all([
        count("academic_sessions"),
        count("academic_sessions", { column: "is_active", value: "true" }),
        count("school_classes"),
        count("school_sections"),
        count("houses"),
        count("fee_heads"),
        count("fee_structures"),
        count("students"),
        count("teachers"),
        supabase.from("school_profile").select("id").limit(1),
      ]);
      return {
        sessions,
        activeSessions,
        classes,
        sections,
        houses,
        feeHeads,
        feeStructures,
        students,
        teachers,
        hasProfile: (profile.data ?? []).length > 0,
      };
    },
  });

  if (isLoading || !data)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading system health…
        </CardContent>
      </Card>
    );

  const checks = [
    { label: "School Profile configured", ok: data.hasProfile, hint: "Set your school details" },
    {
      label: "Exactly one Active academic session",
      ok: data.activeSessions === 1,
      hint: `${data.activeSessions} active`,
    },
    {
      label: "At least one class configured",
      ok: data.classes > 0,
      hint: `${data.classes} classes`,
    },
    {
      label: "At least one section configured",
      ok: data.sections > 0,
      hint: `${data.sections} sections`,
    },
    { label: "Fee heads configured", ok: data.feeHeads > 0, hint: `${data.feeHeads} heads` },
    {
      label: "Fee structures created",
      ok: data.feeStructures > 0,
      hint: `${data.feeStructures} structures`,
    },
    { label: "Students enrolled", ok: data.students > 0, hint: `${data.students} students` },
    {
      label: "Houses configured",
      ok: data.houses > 0,
      hint: `${data.houses} houses`,
      optional: true,
    },
    {
      label: "Teachers added",
      ok: data.teachers > 0,
      hint: `${data.teachers} teachers`,
      optional: true,
    },
  ];

  const missing = checks.filter((c) => !c.ok && !c.optional).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>System Health</span>
          {missing === 0 ? (
            <Badge className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> All good
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {missing} issue(s)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between border rounded-md p-3">
            <div className="flex items-center gap-2">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle
                  className={`h-4 w-4 ${c.optional ? "text-muted-foreground" : "text-destructive"}`}
                />
              )}
              <span className="text-sm">
                {c.label}
                {c.optional && (
                  <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                )}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{c.hint}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
