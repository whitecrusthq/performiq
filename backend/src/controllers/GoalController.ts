import { Op } from "sequelize";
import { Goal, User } from "../models/index.js";

const formatUser = (u: any) => u ? ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  managerId: u.managerId, department: u.department, jobTitle: u.jobTitle, createdAt: u.createdAt,
}) : null;

export default class GoalController {
  static async enrichGoal(goal: any) {
    const plain = goal.get ? goal.get({ plain: true }) : goal;
    const user = await User.findByPk(plain.userId);
    return { ...plain, user: formatUser(user) };
  }

  static async getAll(filters: { userId?: number; cycleId?: number; userRole: string; currentUserId: number }) {
    const where: any = {};
    if (filters.cycleId) where.cycleId = filters.cycleId;
    if (filters.userId) {
      where.userId = filters.userId;
    } else if (filters.userRole === "employee") {
      where.userId = filters.currentUserId;
    } else if (filters.userRole === "manager") {
      const team = await User.findAll({ where: { managerId: filters.currentUserId }, attributes: ["id"] });
      const ids = [filters.currentUserId, ...team.map((m: any) => m.id)];
      where.userId = { [Op.in]: ids };
    }

    const goals = await Goal.findAll({ where, order: [["createdAt", "ASC"]] });
    return Promise.all(goals.map((g: any) => GoalController.enrichGoal(g)));
  }

  static async create(data: { title: string; description?: string; cycleId?: number; userId: number; dueDate?: string; status?: string }) {
    const goal = await Goal.create({
      title: data.title,
      description: data.description,
      cycleId: data.cycleId,
      dueDate: data.dueDate,
      status: data.status ?? "not_started",
      userId: data.userId,
      progress: 0,
    });
    return GoalController.enrichGoal(goal);
  }

  static async update(id: number, data: { title?: string; description?: string; status?: string; dueDate?: string; progress?: number }) {
    const [count, rows] = await Goal.update(data, { where: { id }, returning: true });
    if (!rows[0]) return null;
    return GoalController.enrichGoal(rows[0]);
  }

  static async delete(id: number) {
    await Goal.destroy({ where: { id } });
  }
}
