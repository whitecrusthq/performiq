import { pgTable, serial, text, integer, timestamp, boolean, pgEnum, date } from "drizzle-orm/pg-core";

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
  // HR profile fields
  address: text("address"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  postalCode: text("postal_code"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  nationalId: text("national_id"),
  startDate: date("start_date"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountName: text("bank_account_name"),
  taxId: text("tax_id"),
  pensionId: text("pension_id"),
  notes: text("notes"),
});

export const staffDocumentsTable = pgTable("staff_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  documentType: text("document_type").notNull().default("other"),
  receivedDate: date("received_date"),
  notes: text("notes"),
  uploadedById: integer("uploaded_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type CustomRole = typeof customRolesTable.$inferSelect;
export type StaffDocument = typeof staffDocumentsTable.$inferSelect;
