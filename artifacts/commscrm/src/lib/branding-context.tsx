import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiGet } from "./api";

interface BrandingData {
  appName: string;
  primaryColor: string;
  sidebarColor: string;
  logoData: string | null;
  backgroundData: string | null;
}

interface BrandingContextValue extends BrandingData {
  refreshBranding: () => Promise<void>;
  setBrandingData: (data: Partial<BrandingData>) => void;
}

const defaults: BrandingData = {
  appName: "CommsCRM",
  primaryColor: "#4F46E5",
  sidebarColor: "#3F0E40",
  logoData: null,
  backgroundData: null,
};

const BrandingContext = createContext<BrandingContextValue>({
  ...defaults,
  refreshBranding: async () => {},
  setBrandingData: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandingToDOM(branding: BrandingData) {
  const root = document.documentElement;

  if (/^#[0-9a-fA-F]{6}$/.test(branding.primaryColor)) {
    const primaryHsl = hexToHsl(branding.primaryColor);
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--ring", primaryHsl);
    root.style.setProperty("--sidebar-primary", primaryHsl);
  }

  if (/^#[0-9a-fA-F]{6}$/.test(branding.sidebarColor)) {
    const sidebarHsl = hexToHsl(branding.sidebarColor);
    root.style.setProperty("--sidebar", sidebarHsl);
  }

  if (branding.backgroundData) {
    root.style.setProperty("--crm-bg-image", `url("${branding.backgroundData}")`);
  } else {
    root.style.removeProperty("--crm-bg-image");
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(defaults);

  const applyAndSet = useCallback((data: BrandingData) => {
    const merged = { ...defaults, ...data };
    setBranding(merged);
    applyBrandingToDOM(merged);
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const data = await apiGet<BrandingData>("/branding");
      applyAndSet(data);
    } catch {
      applyBrandingToDOM(defaults);
    }
  }, [applyAndSet]);

  const setBrandingData = useCallback((data: Partial<BrandingData>) => {
    setBranding((prev) => {
      const next = { ...prev, ...data };
      applyBrandingToDOM(next);
      return next;
    });
  }, []);

  useEffect(() => {
    refreshBranding();
  }, [refreshBranding]);

  return (
    <BrandingContext.Provider value={{ ...branding, refreshBranding, setBrandingData }}>
      {children}
    </BrandingContext.Provider>
  );
}
