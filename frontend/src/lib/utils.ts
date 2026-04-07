import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Prepends VITE_API_URL so API calls reach the backend in production.
// Falls back to "" so relative paths still work via Vite proxy in local dev.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

console.log("API_BASE:", API_BASE);

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {}),
    },
  });
}
