import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import { AdminPage } from "./pages/admin/AdminPage";
import { ClaimAdminPage } from "./pages/ClaimAdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { ModulePage } from "./pages/module/ModulePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPage } from "./pages/ResetPage";
import { UsernamePage } from "./pages/UsernamePage";

type Access = "guest" | "user" | "admin";

/**
 * Renders the children only for the wanted audience, otherwise redirects:
 * guests to the login, logged-in users away from guest pages and non-admins away from admin pages.
 * @param {{access: Access, children: ReactNode}} props
 */
function RequireAccess({ access, children }: { access: Access; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (access === "guest") return user ? <Navigate to="/" replace /> : children;
  if (!user) return <Navigate to="/login" replace />;
  if (access === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  // Accounts from before usernames existed must choose one before using the app.
  if (!user.username) return <UsernamePage required />;
  return children;
}

/** Root component with the app's routes. */
export function App() {
  return (
    <main className="container">
      <Routes>
        <Route path="/" element={<RequireAccess access="user"><HomePage /></RequireAccess>} />
        <Route path="/modules/:moduleId" element={<RequireAccess access="user"><ModulePage /></RequireAccess>} />
        <Route path="/admin" element={<RequireAccess access="admin"><AdminPage /></RequireAccess>} />
        <Route path="/username" element={<RequireAccess access="user"><UsernamePage /></RequireAccess>} />
        <Route path="/claim-admin" element={<RequireAccess access="user"><ClaimAdminPage /></RequireAccess>} />
        <Route path="/login" element={<RequireAccess access="guest"><LoginPage /></RequireAccess>} />
        <Route path="/register" element={<RequireAccess access="guest"><RegisterPage /></RequireAccess>} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
