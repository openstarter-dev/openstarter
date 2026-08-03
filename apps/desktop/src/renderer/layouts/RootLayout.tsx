import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

export function RootLayout() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}