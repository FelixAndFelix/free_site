import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPage } from "./pages/ResetPage";

/**
 * Renders the children only for the wanted auth state, otherwise redirects.
 * @param {{loggedIn: boolean, children: ReactNode}} props
 */
function RequireAuth({ loggedIn, children }: { loggedIn: boolean; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  if (Boolean(user) !== loggedIn) return <Navigate to={loggedIn ? "/login" : "/"} replace />;
  return children;
}

/** Root component with the app's routes. */
export function App() {
  return (
    <main className="container">
      <Routes>
        <Route path="/" element={<RequireAuth loggedIn><HomePage /></RequireAuth>} />
        <Route path="/login" element={<RequireAuth loggedIn={false}><LoginPage /></RequireAuth>} />
        <Route path="/register" element={<RequireAuth loggedIn={false}><RegisterPage /></RequireAuth>} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
