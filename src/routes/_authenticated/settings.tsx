import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Eye } from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-role";
import { SchoolProfileTab } from "@/components/settings/school-profile-tab";
import { SessionsTab } from "@/components/settings/sessions-tab";
import { ClassesTab } from "@/components/settings/classes-tab";
import { SectionsTab } from "@/components/settings/sections-tab";
import { HousesTab } from "@/components/settings/houses-tab";
import { FeeHeadsTab } from "@/components/settings/fee-heads-tab";
import { UsersTab } from "@/components/settings/users-tab";
import { SystemHealthTab } from "@/components/settings/system-health-tab";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — School ERP" }] }),
});

function SettingsPage() {
  const { isSuperAdmin, isLoading } = useUserRoles();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure your school. Only Super Admins can make changes."
        actions={
          !isLoading ? (
            isSuperAdmin ? (
              <Badge className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Super Admin
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Eye className="h-3.5 w-3.5" /> View only
              </Badge>
            )
          ) : null
        }
      />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="profile">School Profile</TabsTrigger>
          <TabsTrigger value="sessions">Academic Sessions</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="houses">Houses</TabsTrigger>
          <TabsTrigger value="fee-heads">Fee Heads</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="profile">
            <SchoolProfileTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="classes">
            <ClassesTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="sections">
            <SectionsTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="houses">
            <HousesTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="fee-heads">
            <FeeHeadsTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab canEdit={isSuperAdmin} />
          </TabsContent>
          <TabsContent value="health">
            <SystemHealthTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
