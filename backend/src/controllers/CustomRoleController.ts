import { CustomRole, User } from "../models/index.js";

function parseMenuPerms(raw: string | null | undefined): string[] {
  try { return JSON.parse(raw ?? "[]") ?? []; } catch { return []; }
}

function formatRole(r: CustomRole) {
  return { ...r.get({ plain: true }), menuPermissions: parseMenuPerms(r.menuPermissions) };
}

export default class CustomRoleController {
  static async getAll() {
    const roles = await CustomRole.findAll({ order: [["name", "ASC"]] });
    return roles.map(formatRole);
  }

  static async create(data: { name: string; permissionLevel: string; description?: string; menuPermissions?: string[] }) {
    const menuPermsJson = JSON.stringify(Array.isArray(data.menuPermissions) ? data.menuPermissions : []);
    const role = await CustomRole.create({
      name: data.name,
      permissionLevel: data.permissionLevel,
      description: data.description,
      menuPermissions: menuPermsJson,
    });
    return formatRole(role);
  }

  static async update(id: number, data: { name?: string; permissionLevel?: string; description?: string; menuPermissions?: string[] }) {
    const menuPermsJson = JSON.stringify(Array.isArray(data.menuPermissions) ? data.menuPermissions : []);
    const [count, rows] = await CustomRole.update(
      { name: data.name, permissionLevel: data.permissionLevel, description: data.description, menuPermissions: menuPermsJson },
      { where: { id }, returning: true }
    );
    if (count === 0) return null;
    return formatRole(rows[0]);
  }

  static async delete(id: number) {
    await User.update({ customRoleId: null }, { where: { customRoleId: id } });
    await CustomRole.destroy({ where: { id } });
  }
}
