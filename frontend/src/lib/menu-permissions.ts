// Shared helpers for custom-role menu permissions.
//
// Semantics (matching the Roles page): an EMPTY menuPermissions array means
// "inherit defaults" (all menus allowed by the user's base role). A NON-EMPTY
// array is an explicit allow-list — only those menus are accessible.

// Menu keys in sidebar display order, mapped to their route paths.
export const MENU_KEY_PATHS: { key: string; path: string }[] = [
  { key: "dashboard", path: "/dashboard" },
  { key: "appraisals", path: "/appraisals" },
  { key: "goals", path: "/goals" },
  { key: "cycles", path: "/cycles" },
  { key: "criteria", path: "/criteria" },
  { key: "leave", path: "/leave" },
  { key: "attendance", path: "/attendance" },
  { key: "timesheets", path: "/timesheets" },
  { key: "staff", path: "/staff" },
  { key: "recruitment", path: "/recruitment" },
  { key: "onboarding", path: "/onboarding" },
  { key: "transfers", path: "/transfers" },
  { key: "hr-queries", path: "/hr-queries" },
  { key: "hr-support-dashboard", path: "/hr-support-dashboard" },
  { key: "hr-knowledge-base", path: "/hr-knowledge-base" },
  { key: "anniversaries", path: "/anniversaries" },
  { key: "reports", path: "/reports" },
  { key: "users", path: "/users" },
  { key: "departments", path: "/departments" },
  { key: "sites", path: "/sites" },
  { key: "roles", path: "/roles" },
  { key: "security", path: "/security" },
  { key: "notifications", path: "/notifications" },
  { key: "appearance", path: "/appearance" },
  { key: "ai-settings", path: "/ai-settings" },
  { key: "audit-log", path: "/audit-log" },
  { key: "storage-providers", path: "/storage-providers" },
  { key: "legal", path: "/legal" },
  { key: "handbook", path: "/handbook" },
  { key: "quiz", path: "/quiz" },
  { key: "quiz-results", path: "/quiz-results" },
];

const KNOWN_MENU_KEYS = new Set(MENU_KEY_PATHS.map((m) => m.key));

/** Returns the user's explicit custom-role menu allow-list, or [] when inheriting defaults. */
export function getCustomMenuPerms(user: any): string[] {
  const perms = user?.customRole?.menuPermissions;
  return Array.isArray(perms) && perms.length > 0 ? perms : [];
}

/** Whether the user may access the given menu key. */
export function hasMenuAccess(user: any, menuKey: string): boolean {
  const perms = getCustomMenuPerms(user);
  if (perms.length === 0) return true; // inherit defaults — base-role rules apply
  return perms.includes(menuKey);
}

/**
 * If `path` belongs to a known menu section, returns its menu key; otherwise
 * null (e.g. /profile, /legal — not governed by menu permissions).
 */
export function menuKeyForPath(path: string): string | null {
  const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
  return KNOWN_MENU_KEYS.has(firstSegment) ? firstSegment : null;
}

/** Where the user should land after login: /dashboard if allowed, else their first permitted menu. */
export function defaultLandingPath(user: any): string {
  if (hasMenuAccess(user, "dashboard")) return "/dashboard";
  const perms = getCustomMenuPerms(user);
  const first = MENU_KEY_PATHS.find((m) => perms.includes(m.key));
  return first ? first.path : "/profile";
}
