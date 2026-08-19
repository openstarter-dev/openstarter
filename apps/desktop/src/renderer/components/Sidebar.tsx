// apps/desktop/src/renderer/components/Sidebar.tsx —— 侧边栏导航

import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@openstarter/ui-web/components/button";
import { useAuth } from "../contexts/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/settings", label: "Settings" },
  { to: "/about", label: "About" },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="mb-4 px-5 py-4 text-lg font-semibold text-foreground">OpenStarter</div>
      <div className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="mt-auto space-y-2 p-4">
        {user && <div className="mb-2 truncate text-xs text-muted-foreground">{user.email}</div>}
        <Button variant="outline" className="w-full" onClick={handleLogout} type="button">
          Logout
        </Button>
      </div>
    </nav>
  );
}
