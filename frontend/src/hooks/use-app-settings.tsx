import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "@/lib/utils";

export interface AppSettings {
  companyName: string;
  logoLetter: string;
  logoUrl: string | null;
  primaryHsl: string;
  themeName: string;
  loginHeadline: string;
  loginSubtext: string;
}

const defaults: AppSettings = {
  companyName: "PerformIQ",
  logoLetter: "P",
  logoUrl: null,
  primaryHsl: "221 83% 53%",
  themeName: "blue",
  loginHeadline: "Elevate Your Team's Performance.",
  loginSubtext: "PerformIQ streamlines appraisals, goals, and feedback into one elegant platform.",
};

const CACHE_KEY = "performiq.appSettings";

function readCachedSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return defaults;
    const cached = JSON.parse(raw);
    return { ...defaults, ...cached };
  } catch {
    return defaults;
  }
}

const AppSettingsContext = createContext<{
  settings: AppSettings;
  reload: () => void;
}>({ settings: defaults, reload: () => {} });

function applyTheme(hsl: string) {
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  // Seed from localStorage so the first render already shows the user's
  // saved company name, logo letter, and theme — no flash of defaults.
  const [settings, setSettings] = useState<AppSettings>(readCachedSettings);

  const load = () => {
    apiFetch("/api/app-settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const s: AppSettings = {
            companyName: data.companyName || defaults.companyName,
            logoLetter: data.logoLetter || defaults.logoLetter,
            logoUrl: data.logoUrl || null,
            primaryHsl: data.primaryHsl || defaults.primaryHsl,
            themeName: data.themeName || defaults.themeName,
            loginHeadline: typeof data.loginHeadline === "string" ? data.loginHeadline : defaults.loginHeadline,
            loginSubtext: typeof data.loginSubtext === "string" ? data.loginSubtext : defaults.loginSubtext,
          };
          setSettings(s);
          applyTheme(s.primaryHsl);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch { /* ignore quota */ }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Re-apply the cached theme on mount in case the inline bootstrap script
    // didn't run (e.g. localStorage was cleared between then and React mount).
    applyTheme(settings.primaryHsl);
    load();
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, reload: load }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
