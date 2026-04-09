import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setToken, clearToken, apiGet } from "./api";

export interface CrmAgent {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  allowedMenus: string[] | null;
}

interface AuthContextType {
  agent: CrmAgent | null;
  isLoading: boolean;
  login: (token: string, agent: CrmAgent) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<CrmAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("crm_agent");
    const token = localStorage.getItem("crm_token");
    if (stored && token) {
      try {
        setAgent(JSON.parse(stored) as CrmAgent);
      } catch {
        clearToken();
      }
    }
    setIsLoading(false);
  }, []);

  function login(token: string, agentData: CrmAgent) {
    setToken(token);
    localStorage.setItem("crm_agent", JSON.stringify(agentData));
    setAgent(agentData);
  }

  function logout() {
    clearToken();
    setAgent(null);
  }

  return (
    <AuthContext.Provider value={{ agent, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
