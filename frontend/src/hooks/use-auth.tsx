// @refresh reset
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { User } from "../lib";
import { getMe } from "../lib";
import { apiFetch } from "@/lib/utils";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default fallback if the server config can't be fetched. Admins can change
// the actual value from the Security Settings page (security_settings.idle_timeout_minutes).
const DEFAULT_IDLE_TIMEOUT_MIN = 30;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const [idleTimeoutMs, setIdleTimeoutMs] = useState<number>(DEFAULT_IDLE_TIMEOUT_MIN * 60 * 1000);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await getMe({
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        setUser(userData);
      } catch (error) {
        console.error("Auth init failed:", error);
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    sessionStorage.removeItem("authNotice");
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  // Fetch the admin-configured idle timeout once we have a token. Falls back
  // silently to the default if the request fails so a degraded /api never
  // leaves users with no auto-logout.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/api/security/session-config")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        const mins = Number(data.idleTimeoutMinutes);
        if (Number.isFinite(mins) && mins >= 1 && mins <= 1440) {
          setIdleTimeoutMs(mins * 60 * 1000);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  // Idle-timeout auto-logout: only active while the user is signed in.
  useEffect(() => {
    if (!token) return;

    const reset = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        sessionStorage.setItem("authNotice", "idle_timeout");
        logout();
      }, idleTimeoutMs);
    };

    const events: (keyof DocumentEventMap)[] = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [token, idleTimeoutMs]);

  // Global hook: any 401 from apiFetch (e.g. session replaced by a fresh login
  // elsewhere, or token rejected on the server) bounces the user to /login.
  useEffect(() => {
    const onInvalid = () => {
      if (localStorage.getItem("token")) logout();
    };
    window.addEventListener("auth:invalid", onInvalid);
    return () => window.removeEventListener("auth:invalid", onInvalid);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
