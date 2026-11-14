import { createHashRouter } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { LoginPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { SettingsPage } from "./pages/settings";
import { AboutPage } from "./pages/about";
import { RequireAuth } from "./components/RequireAuth";

// Use hash router so packaged file:// URLs match routes reliably
// 使用 Hash 路由以兼容生产包 file:// 协议加载
export const router = createHashRouter([
  {
    path: "/login",
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "about", element: <AboutPage /> },
        ],
      },
    ],
  },
]);
