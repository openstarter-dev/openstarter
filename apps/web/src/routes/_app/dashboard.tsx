import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { session } = Route.useRouteContext();
  const name = session.data?.user.name ?? "there";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-bold text-2xl">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {name}.</p>
      </div>
      {/* TODO: replace with your app's main view */}
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>A few pointers to help you make this template your own.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link className="text-primary hover:underline" to="/settings">
                Configure your account settings
              </Link>
            </li>
            <li className="text-muted-foreground">
              Open CUSTOMIZE.md in the project root to rebrand the template.
            </li>
            <li className="text-muted-foreground">
              Check the README for available scripts and deployment.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
