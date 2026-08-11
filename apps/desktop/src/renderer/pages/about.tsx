// apps/desktop/src/renderer/pages/about.tsx —— 关于页

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";

export function AboutPage() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <p className="mb-1">OpenStarter Desktop</p>
          <p>Version: {version || "loading..."}</p>
        </CardContent>
      </Card>
    </div>
  );
}