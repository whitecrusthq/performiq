import { pgTable, serial, text, integer, timestamp, boolean, pgEnum, unique } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "admin", "manager", "employee"]);

export const customRolesTable = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissionLevel: roleEnum("permission_level").notNull().default("employee"),
  description: text("description"),
  menuPermissions: text("menu_permissions").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  customRoleId: integer("custom_role_id"),
  managerId: integer("manager_id"),
  siteId: integer("site_id"),
  department: text("department"),
  jobTitle: text("job_title"),
  phone: text("phone"),
  staffId: text("staff_id"),
  profilePhoto: text("profile_photo"),
  isLocked: boolean("is_locked").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type CustomRole = typeof customRolesTable.$inferSelect;
