import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MigrationProgressTable } from "@/components/migration/migration-progress";
import { ArrowRight, ShieldCheck, Users, Wallet } from "lucide-react";

export function DataMigrationTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Migration Toolkit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Onboard an existing school in the recommended order: masters first, then students,
            teachers and opening balances, and finally the go-live validation.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/migration">
                Open Migration Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/migration/students">
                <Users className="h-4 w-4" /> Student Migration
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/fees/import">
                <Wallet className="h-4 w-4" /> Opening Balances
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/migration/go-live">
                <ShieldCheck className="h-4 w-4" /> Go-Live Validation
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <MigrationProgressTable />
    </div>
  );
}
