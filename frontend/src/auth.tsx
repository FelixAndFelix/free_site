import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, UserResponse } from "@free-site/shared";
import { apiRequest } from "./api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Loads the current user once and shares it with the whole app.
 * @param {{children: ReactNode}} props
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<UserResponse>("/api/auth/me").then((result) => {
      if (result.ok) setUser(result.data.user);
      setLoading(false);
    });
  }, []);

  /** Ends the session on the server and forgets the user locally. */
  async function logout() {
    await apiRequest("/api/auth/logout", {});
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, setUser, logout }}>{children}</AuthContext.Provider>;
}

/** Returns the auth state; must be used inside AuthProvider. */
export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside AuthProvider");
  return state;
}
