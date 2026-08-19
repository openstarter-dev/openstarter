import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
