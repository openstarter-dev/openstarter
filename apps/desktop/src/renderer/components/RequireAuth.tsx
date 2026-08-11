// apps/desktop/src/renderer/components/RequireAuth.tsx —— 路由守卫

import { Navigate, Outlet } from "react-router-dom";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { useAuth } from "../contexts/AuthContext";

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}