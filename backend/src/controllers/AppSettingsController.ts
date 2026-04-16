import { AppSettings } from "../models/index.js";

export default class AppSettingsController {
  static async get() {
    const row = await AppSettings.findOne({ where: { id: 1 } });
    if (row) return row;
    const inserted = await AppSettings.create({ id: 1 });
    return inserted;
  }

  static async update(data: {
    companyName?: string; logoLetter?: string; primaryHsl?: string; themeName?: string;
    loginHeadline?: string; loginSubtext?: string; loginBgFrom?: string; loginBgTo?: string;
  }) {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof data.companyName === "string" && data.companyName.trim()) updates.companyName = data.companyName.trim().slice(0, 60);
    if (typeof data.logoLetter === "string" && data.logoLetter.trim()) updates.logoLetter = data.logoLetter.trim().slice(0, 3);
    if (typeof data.primaryHsl === "string") updates.primaryHsl = data.primaryHsl;
    if (typeof data.themeName === "string") updates.themeName = data.themeName;
    if (typeof data.loginHeadline === "string") updates.loginHeadline = data.loginHeadline.slice(0, 200);
    if (typeof data.loginSubtext === "string") updates.loginSubtext = data.loginSubtext.slice(0, 400);
    if (typeof data.loginBgFrom === "string") updates.loginBgFrom = data.loginBgFrom;
    if (typeof data.loginBgTo === "string") updates.loginBgTo = data.loginBgTo;
    const [, rows] = await AppSettings.update(updates, { where: { id: 1 }, returning: true });
    return rows[0];
  }
}
