import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["admin", "manager", "employee"]);

export const customRolesTable = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissionLevel: roleEnum("permission_level").notNull().default("employee"),
  description: text("description"),
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
  department: text("department"),
  jobTitle: text("job_title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertCustomRoleSchema = createInsertSchema(customRolesTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCustomRole = z.infer<typeof insertCustomRoleSchema>;
export type User = typeof usersTable.$inferSelect;
export type CustomRole = typeof customRolesTable.$inferSelect;
