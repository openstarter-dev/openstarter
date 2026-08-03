import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard" },
  { to: "/settings", label: "Settings" },
  { to: "/about", label: "About" },
];

export function Sidebar() {
  return (
    <nav
      style={{
        width: "240px",
        height: "100%",
        background: "#111",
        borderRight: "1px solid #222",
        padding: "16px 0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 20px",
          fontSize: "18px",
          fontWeight: 600,
          marginBottom: "16px",
        }}
      >
        OpenStarter
      </div>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          style={({ isActive }) => ({
            padding: "10px 20px",
            color: isActive ? "#fff" : "#888",
            background: isActive ? "#222" : "transparent",
            textDecoration: "none",
            fontSize: "14px",
          })}
        >
          {item.label}
        </NavLink>
      ))}
      <div style={{ marginTop: "auto", padding: "12px 20px" }}>
        <button
          onClick={() => {
            localStorage.removeItem("auth-token");
            window.location.href = "/login";
          }}
          type="button"
          style={{
            background: "none",
            border: "1px solid #333",
            color: "#888",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}