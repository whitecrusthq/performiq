import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Use the app's base path so API calls go through /piq/api/... → Vite proxy → backend.
const API_BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL ?? "").replace(/\/+$/, "");

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
