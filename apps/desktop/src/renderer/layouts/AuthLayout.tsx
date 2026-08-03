import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px", padding: "24px" }}>
        <Outlet />
      </div>
    </div>
  );
}