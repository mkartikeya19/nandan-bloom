import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ReadOnlyNotice } from "./read-only-notice";
import { Loader2 } from "lucide-react";

type Profile = {
  id?: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  udise_code: string | null;
  affiliation_board: string | null;
  affiliation_number: string | null;
  principal_name: string | null;
  established_year: number | null;
  logo_url: string | null;
};

const empty: Profile = {
  name: "Nandan Kids Higher Secondary School",
  address: "", city: "", state: "", pincode: "",
  phone: "", email: "", website: "",
  udise_code: "", affiliation_board: "", affiliation_number: "",
  principal_name: "", established_year: null, logo_url: "",
};

export function SchoolProfileTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["school_profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_profile").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const [form, setForm] = useState<Profile>(empty);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("School name is required");
      const payload = {
        ...form,
        established_year: form.established_year ? Number(form.established_year) : null,
      };
      if (data?.id) {
        const { error } = await supabase.from("school_profile").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("school_profile").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("School profile saved"); qc.invalidateQueries({ queryKey: ["school_profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => ({ ...f, [k]: v }));
  const disabled = !canEdit;

  return (
    <Card>
      <CardHeader>
        <CardTitle>School profile</CardTitle>
        <CardDescription>Appears on receipts, reports, and communications.</CardDescription>
      </CardHeader>
      <CardContent>
        {!canEdit && <ReadOnlyNotice />}
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">School name *</Label>
            <Input id="name" required disabled={disabled} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" disabled={disabled} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2"><Label>City</Label><Input disabled={disabled} value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="space-y-2"><Label>State</Label><Input disabled={disabled} value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} /></div>
          <div className="space-y-2"><Label>Pincode</Label><Input disabled={disabled} value={form.pincode ?? ""} onChange={(e) => set("pincode", e.target.value)} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input disabled={disabled} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" disabled={disabled} value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="space-y-2"><Label>Website</Label><Input disabled={disabled} value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://..." /></div>
          <div className="space-y-2"><Label>UDISE+ code</Label><Input disabled={disabled} value={form.udise_code ?? ""} onChange={(e) => set("udise_code", e.target.value)} placeholder="11-digit" /></div>
          <div className="space-y-2"><Label>Board / Affiliation</Label><Input disabled={disabled} value={form.affiliation_board ?? ""} onChange={(e) => set("affiliation_board", e.target.value)} placeholder="CBSE / State Board" /></div>
          <div className="space-y-2"><Label>Affiliation number</Label><Input disabled={disabled} value={form.affiliation_number ?? ""} onChange={(e) => set("affiliation_number", e.target.value)} /></div>
          <div className="space-y-2"><Label>Principal name</Label><Input disabled={disabled} value={form.principal_name ?? ""} onChange={(e) => set("principal_name", e.target.value)} /></div>
          <div className="space-y-2"><Label>Established year</Label><Input type="number" min={1800} max={2100} disabled={disabled} value={form.established_year ?? ""} onChange={(e) => set("established_year", e.target.value ? Number(e.target.value) : null)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Logo URL</Label><Input disabled={disabled} value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." /></div>
          {canEdit && (
            <div className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
