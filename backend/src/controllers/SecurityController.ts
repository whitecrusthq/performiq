import { User, SecuritySettings } from "../models/index.js";

export default class SecurityController {
  static async getSettings() {
    const row = await SecuritySettings.findOne({ where: { id: 1 } });
    if (row) return row;
    const inserted = await SecuritySettings.create({ id: 1, lockoutEnabled: true, maxAttempts: 5, lockoutDurationMinutes: 30 });
    return inserted;
  }

  static async updateSettings(data: { lockoutEnabled?: boolean; maxAttempts?: number; lockoutDurationMinutes?: number }) {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof data.lockoutEnabled === "boolean") updates.lockoutEnabled = data.lockoutEnabled;
    if (typeof data.maxAttempts === "number" && data.maxAttempts >= 1 && data.maxAttempts <= 50) updates.maxAttempts = data.maxAttempts;
    if (typeof data.lockoutDurationMinutes === "number" && data.lockoutDurationMinutes >= 1) updates.lockoutDurationMinutes = data.lockoutDurationMinutes;
    const [, rows] = await SecuritySettings.update(updates, { where: { id: 1 }, returning: true });
    return rows[0];
  }

  static async getLockedAccounts() {
    return User.findAll({
      where: { isLocked: true },
      attributes: ["id", "name", "email", "role", "lockedAt", "failedLoginAttempts"],
    });
  }

  static async unlockAccount(userId: number) {
    const [count, rows] = await User.update(
      { isLocked: false, failedLoginAttempts: 0, lockedAt: null },
      { where: { id: userId }, returning: true }
    );
    if (count === 0) return null;
    const u = rows[0];
    return { id: u.id, name: u.name, email: u.email };
  }
}
