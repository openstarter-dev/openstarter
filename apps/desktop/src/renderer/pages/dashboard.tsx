// apps/desktop/src/renderer/pages/dashboard.tsx —— 仪表盘

import { Card, CardContent, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Welcome to OpenStarter Desktop.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}