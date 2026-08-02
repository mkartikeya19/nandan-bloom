import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Layers, Wallet, Gift, Settings2, Upload, Receipt } from "lucide-react";

const tabs: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/fees", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/fees/structures", label: "Fee Structures", icon: Layers },
  { to: "/fees/collect", label: "Collect Fee", icon: Wallet },
  { to: "/fees/receipts", label: "Receipts", icon: Receipt },
  { to: "/fees/concessions", label: "Concessions", icon: Gift },
  { to: "/fees/import", label: "Opening Balance Migration", icon: Upload },
  { to: "/fees/settings", label: "Settings", icon: Settings2 },
];

export function FeesTabs() {
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
