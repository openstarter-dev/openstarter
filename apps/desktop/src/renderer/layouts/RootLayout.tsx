import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

export function RootLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}