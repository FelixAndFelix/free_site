import type { ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router";
import { ChartBar, ShieldCheck, SignOut, UserCircle } from "@phosphor-icons/react";
import { LogoMark } from "./LogoMark";
import { useAuth } from "./auth";
import { AccountDeletedPage } from "./pages/AccountDeletedPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminPage } from "./pages/admin/AdminPage";
import { ClaimAdminPage } from "./pages/ClaimAdminPage";
import { HomePage } from "./pages/HomePage";
import { JoinPage } from "./pages/JoinPage";
import { LoginPage } from "./pages/LoginPage";
import { ModulePage } from "./pages/module/ModulePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPage } from "./pages/ResetPage";
import { UsernamePage } from "./pages/UsernamePage";

type Access = "guest" | "user" | "admin" | "any";

/**
 * Renders the children only for the wanted audience, otherwise redirects:
 * guests to the login, logged-in users away from guest pages and non-admins away from admin pages;
 * "any" lets everyone in.
 * @param {{access: Access, children: ReactNode}} props
 */
function RequireAccess({ access, children }: { access: Access; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Someone who logs in from an invite link continues at the link. Registering needs no detour:
  // the new account is already in the course.
  const joinCode = location.pathname === "/login" ? new URLSearchParams(location.search).get("join") : null;
  if (loading) return <p className="muted" role="status">Loading…</p>;
  if (access === "guest") {
    return user ? <Navigate to={joinCode ? `/join/${encodeURIComponent(joinCode)}` : "/"} replace /> : children;
  }
  // Pages for everyone, like invite links: guests may see them, accounts still need a username.
  if (access === "any") return user && !user.username ? <UsernamePage required /> : children;
  if (!user) return <Navigate to="/login" replace />;
  if (access === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  // Accounts from before usernames existed must choose one before using the app.
  if (!user.username) return <UsernamePage required />;
  return children;
}

/**
 * The bar at the top of every page: the wordmark, and for logged-in users the admin link, their
 * account and logging out. On narrow screens the labels collapse to icons but stay readable for
 * screen readers.
 */
function AppBar() {
  const { user, logout } = useAuth();
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <Link to="/" className="brand" translate="no">
          <LogoMark className="brand-mark" />
          <span className="wordmark">free_site</span>
        </Link>
        {user && (
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/" end className="nav-item">
              <ChartBar aria-hidden="true" />
              <span className="nav-label">Overview</span>
            </NavLink>
            {user.role === "admin" && (
              <NavLink to="/admin" className="nav-item">
                <ShieldCheck aria-hidden="true" />
                <span className="nav-label">Admin</span>
              </NavLink>
            )}
            <NavLink to="/account" className="nav-item" aria-label={`${user.username ?? "Your"} (account)`}>
              <UserCircle aria-hidden="true" />
              <span className="nav-name">{user.username ?? "Account"}</span>
            </NavLink>
            <button type="button" className="nav-item" onClick={logout}>
              <SignOut aria-hidden="true" />
              <span className="nav-label">Log out</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

/**
 * Login, registration and reset: the form next to a short explanation of what free_site is,
 * stacked on phones.
 * @param {{children: ReactNode}} props
 */
function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <p className="auth-title">Which exams are free?</p>
        <p>
          Your course rates every module as free, possible or impossible. Everyone sees the totals, nobody sees who
          voted what.
        </p>
      </div>
      {children}
    </div>
  );
}

/** Root component with the app's routes. */
export function App() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppBar />
      <main id="main" className="container" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<RequireAccess access="user"><HomePage /></RequireAccess>} />
          <Route path="/modules/:moduleId" element={<RequireAccess access="user"><ModulePage /></RequireAccess>} />
          <Route path="/admin" element={<RequireAccess access="admin"><AdminPage /></RequireAccess>} />
          <Route path="/account" element={<RequireAccess access="user"><AccountPage /></RequireAccess>} />
          <Route path="/account-deleted" element={<AccountDeletedPage />} />
          <Route path="/username" element={<RequireAccess access="user"><UsernamePage /></RequireAccess>} />
          <Route path="/claim-admin" element={<RequireAccess access="user"><ClaimAdminPage /></RequireAccess>} />
          <Route path="/login" element={<RequireAccess access="guest"><AuthLayout><LoginPage /></AuthLayout></RequireAccess>} />
          <Route path="/register" element={<RequireAccess access="guest"><AuthLayout><RegisterPage /></AuthLayout></RequireAccess>} />
          <Route path="/join/:code" element={<RequireAccess access="any"><JoinPage /></RequireAccess>} />
          <Route path="/reset" element={<AuthLayout><ResetPage /></AuthLayout>} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <Link to="/privacy">Privacy</Link>
        <a href="/.well-known/security.txt">Security</a>
      </footer>
    </>
  );
}
