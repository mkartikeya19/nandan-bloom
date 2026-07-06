import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 backdrop-blur px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Nandan Kids Higher Secondary School</p>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-[var(--gradient-subtle)]">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
