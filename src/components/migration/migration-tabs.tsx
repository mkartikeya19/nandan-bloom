import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Wallet, ShieldCheck, History } from "lucide-react";

const tabs: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/migration", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/migration/students", label: "Student Migration", icon: Users },
  { to: "/fees/import", label: "Opening Balances", icon: Wallet },
  { to: "/migration/go-live", label: "Go-Live Validation", icon: ShieldCheck },
  { to: "/migration/batches", label: "Batches & Rollback", icon: History },
];

export function MigrationTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.to
          : pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Button
            asChild
            key={t.to}
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-none border-b-2 border-transparent -mb-px",
              active && "border-primary text-primary",
            )}
          >
            <Link to={t.to}>
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
