import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default("PerformIQ"),
  logoLetter: text("logo_letter").notNull().default("P"),
  primaryHsl: text("primary_hsl").notNull().default("221 83% 53%"),
  themeName: text("theme_name").notNull().default("blue"),
  loginHeadline: text("login_headline").notNull().default("Elevate Your Team's Performance."),
  loginSubtext: text("login_subtext").notNull().default("PerformIQ streamlines appraisals, goals, and feedback into one elegant platform."),
  loginBgFrom: text("login_bg_from").notNull().default(""),
  loginBgTo: text("login_bg_to").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
