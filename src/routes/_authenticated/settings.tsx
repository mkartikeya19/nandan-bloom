import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — School ERP" }] }),
});

function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
      if (p) {
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");
      }
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles((r ?? []).map((x) => x.role));
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      phone,
      email: user.email,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile and school preferences." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>My profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 ..." />
              </div>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles & permissions</CardTitle>
            <CardDescription>Roles are managed by the school administrator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {roles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No roles assigned yet. Ask an administrator to grant you access.
                </p>
              ) : (
                roles.map((r) => (
                  <Badge key={r} variant="default" className="capitalize">{r}</Badge>
                ))
              )}
            </div>
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Available roles: <span className="font-medium">admin</span>, <span className="font-medium">teacher</span>, <span className="font-medium">staff</span>.
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>School information</CardTitle>
            <CardDescription>These details appear on receipts and reports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>School name</Label>
              <Input defaultValue="Nandan Kids Higher Secondary School" />
            </div>
            <div className="space-y-2">
              <Label>Academic year</Label>
              <Input placeholder="e.g. 2025-2026" />
            </div>
            <div className="space-y-2">
              <Label>UDISE code</Label>
              <Input placeholder="11-digit UDISE+" />
            </div>
            <div className="space-y-2">
              <Label>Board / Affiliation</Label>
              <Input placeholder="e.g. CBSE / State Board" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
