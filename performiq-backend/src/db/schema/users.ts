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
  // Name breakdown
  surname: text("surname"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  // Personal info
  address: text("address"),
  permanentAddress: text("permanent_address"),
  permanentCity: text("permanent_city"),
  permanentState: text("permanent_state"),
  permanentCountry: text("permanent_country"),
  permanentPostalCode: text("permanent_postal_code"),
  temporaryAddress: text("temporary_address"),
  temporaryCity: text("temporary_city"),
  temporaryState: text("temporary_state"),
  temporaryCountry: text("temporary_country"),
  temporaryPostalCode: text("temporary_postal_code"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  postalCode: text("postal_code"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  maritalStatus: text("marital_status"),
  maidenName: text("maiden_name"),
  religion: text("religion"),
  stateOfOrigin: text("state_of_origin"),
  nationality: text("nationality"),
  nationalId: text("national_id"),
  hobbies: text("hobbies"),
  // Spouse & family
  spouseName: text("spouse_name"),
  spouseOccupation: text("spouse_occupation"),
  numberOfChildren: integer("number_of_children"),
  weddingDate: date("wedding_date"),
  // Employment
  startDate: date("start_date"),
  probationEndDate: date("probation_end_date"),
  probationStatus: text("probation_status"),
  // Next of kin
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  emergencyContactAddress: text("emergency_contact_address"),
  // Financial
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountName: text("bank_account_name"),
  taxId: text("tax_id"),
  pensionId: text("pension_id"),
  pfaName: text("pfa_name"),
  rsaPin: text("rsa_pin"),
  hmo: text("hmo"),
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

export const staffBeneficiariesTable = pgTable("staff_beneficiaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  phoneNumber: text("phone_number"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffWorkExperienceTable = pgTable("staff_work_experience", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  companyAddress: text("company_address"),
  positionHeld: text("position_held"),
  fromDate: text("from_date"),
  toDate: text("to_date"),
  reasonForLeaving: text("reason_for_leaving"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffEducationTable = pgTable("staff_education", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  schoolAttended: text("school_attended").notNull(),
  certificateObtained: text("certificate_obtained"),
  fromDate: text("from_date"),
  toDate: text("to_date"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffReferencesTable = pgTable("staff_references", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  refNumber: integer("ref_number").notNull().default(1),
  name: text("name"),
  address: text("address"),
  occupation: text("occupation"),
  age: text("age"),
  telephone: text("telephone"),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const disciplinaryRecordsTable = pgTable("disciplinary_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("disciplinary"),
  subject: text("subject").notNull(),
  description: text("description"),
  sanctionApplied: text("sanction_applied"),
  severity: text("severity").notNull().default("minor"),
  incidentDate: date("incident_date"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const disciplinaryAttachmentsTable = pgTable("disciplinary_attachments", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => disciplinaryRecordsTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  objectPath: text("object_path").notNull(),
  uploadedById: integer("uploaded_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffRemindersTable = pgTable("staff_reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  reminderType: text("reminder_type").notNull().default("other"),
  reminderDate: date("reminder_date").notNull(),
  recurring: boolean("recurring").notNull().default(true),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type CustomRole = typeof customRolesTable.$inferSelect;
export type StaffDocument = typeof staffDocumentsTable.$inferSelect;
export type StaffBeneficiary = typeof staffBeneficiariesTable.$inferSelect;
export type StaffWorkExperience = typeof staffWorkExperienceTable.$inferSelect;
export type StaffEducation = typeof staffEducationTable.$inferSelect;
export type StaffReference = typeof staffReferencesTable.$inferSelect;
export type DisciplinaryRecord = typeof disciplinaryRecordsTable.$inferSelect;
export type DisciplinaryAttachment = typeof disciplinaryAttachmentsTable.$inferSelect;
export type StaffReminder = typeof staffRemindersTable.$inferSelect;
