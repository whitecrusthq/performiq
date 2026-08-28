import { User } from "../models/index.js";

/**
 * Protected accounts (users.is_protected) are hidden from everyone below
 * super admin. Merge this into a Sequelize `where` on the users table.
 */
export function protectedWhere(role?: string | null): Record<string, any> {
  return role === "super_admin" ? {} : { isProtected: false };
}

/**
 * IDs of protected users, for filtering rows that reference users
 * (appraisals, goals, leave requests, reminders...). Optionally keeps
 * `exceptUserId` visible (e.g. a protected viewer must still see themself).
 */
export async function getProtectedUserIds(exceptUserId?: number): Promise<Set<number>> {
  const rows = await User.findAll({ where: { isProtected: true }, attributes: ["id"] });
  const ids = new Set<number>(rows.map((r: any) => r.id));
  if (exceptUserId !== undefined) ids.delete(exceptUserId);
  return ids;
}
