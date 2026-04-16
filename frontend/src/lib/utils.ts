import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init?.headers ?? {}),
    },
  });
}
