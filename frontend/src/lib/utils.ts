import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Resolve an upload URL returned by the backend. The provider-aware proxy flow
// returns a RELATIVE path (e.g. "/api/storage/proxy-upload/<jwt>") which must be
// resolved against the API base (VITE_API_URL) — otherwise, when the frontend is
// hosted on a different origin than the backend (e.g. the SPA on Vercel), the
// browser resolves it against the page origin and the PUT hits the static host
// (returning 405) instead of the backend. Absolute URLs (the Replit Object
// Storage signed-URL fallback) are returned unchanged.
export function resolveUploadUrl(uploadURL: string): string {
  if (/^https?:\/\//i.test(uploadURL)) return uploadURL;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  return `${base}${uploadURL}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {}),
    },
  });
  // Global session-invalidation handler: if the backend rejects the token
  // because another login replaced this session, surface it to the auth layer
  // so the user is bounced to /login with a clear notice.
  if (r.status === 401 && localStorage.getItem("token") && !path.startsWith("/api/auth/")) {
    let reason: string | null = null;
    try {
      const cloned = r.clone();
      const body = await cloned.json();
      reason = body?.reason ?? null;
    } catch { /* not JSON */ }
    if (reason === "session_replaced") {
      sessionStorage.setItem("authNotice", "session_replaced");
    } else {
      sessionStorage.setItem("authNotice", "session_expired");
    }
    window.dispatchEvent(new CustomEvent("auth:invalid"));
  }
  return r;
}
