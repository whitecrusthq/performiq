import { Department, User } from "../models/index.js";

export default class DepartmentController {
  static async listAll() {
    const depts = await Department.findAll({ order: [["name", "ASC"]] });
    const users = await User.findAll({ attributes: ["id", "department"] });
    const countMap = users.reduce<Record<string, number>>((acc, u) => {
      if (u.department) acc[u.department] = (acc[u.department] || 0) + 1;
      return acc;
    }, {});
    return depts.map(d => {
      const dJson = d.toJSON() as any;
      return { ...dJson, employeeCount: countMap[dJson.name] || 0 };
    });
  }

  static async create(name: string, description?: string) {
    return Department.create({
      name: name.trim(),
      description: description?.trim() || null,
    });
  }

  static async update(id: number, name: string, description?: string) {
    const [count, rows] = await Department.update(
      { name: name.trim(), description: description?.trim() || null },
      { where: { id }, returning: true }
    );
    if (count === 0) return null;
    return rows[0];
  }

  static async delete(id: number) {
    const count = await Department.destroy({ where: { id } });
    if (count === 0) return null;
    return true;
  }
}
