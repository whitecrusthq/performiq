import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "@/lib/utils";

export interface AppSettings {
  companyName: string;
  logoLetter: string;
  primaryHsl: string;
  themeName: string;
}

const defaults: AppSettings = {
  companyName: "PerformIQ",
  logoLetter: "P",
  primaryHsl: "221 83% 53%",
  themeName: "blue",
};

const AppSettingsContext = createContext<{
  settings: AppSettings;
  reload: () => void;
}>({ settings: defaults, reload: () => {} });

function applyTheme(hsl: string) {
  document.documentElement.style.setProperty("--primary", hsl);
  document.documentElement.style.setProperty("--ring", hsl);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults);

  const load = () => {
    apiFetch("/api/app-settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const s: AppSettings = {
            companyName: data.companyName || defaults.companyName,
            logoLetter: data.logoLetter || defaults.logoLetter,
            primaryHsl: data.primaryHsl || defaults.primaryHsl,
            themeName: data.themeName || defaults.themeName,
          };
          setSettings(s);
          applyTheme(s.primaryHsl);
        }
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, reload: load }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
