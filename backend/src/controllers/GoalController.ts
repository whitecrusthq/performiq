import { Op } from "sequelize";
import { Goal, User } from "../models/index.js";
import { getProtectedUserIds } from "../utils/protectedUsers.js";

const formatUser = (u: any) => u ? ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  managerId: u.managerId, department: u.department, jobTitle: u.jobTitle, siteId: u.siteId, createdAt: u.createdAt,
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

    let goals = await Goal.findAll({ where, order: [["createdAt", "ASC"]] });
    if (filters.userRole !== "super_admin") {
      // Goals of protected accounts stay hidden below super admin
      // (a protected viewer still sees their own goals).
      const protectedIds = await getProtectedUserIds(filters.currentUserId);
      goals = goals.filter((g: any) => !protectedIds.has(g.userId));
    }
    return Promise.all(goals.map((g: any) => GoalController.enrichGoal(g)));
  }

  /** True when the viewer may not target this user (protected account). */
  static async isHiddenFrom(targetUserId: number, viewer?: { id: number; role: string }): Promise<boolean> {
    if (!viewer || viewer.role === "super_admin" || targetUserId === viewer.id) return false;
    const target: any = await User.findByPk(targetUserId, { attributes: ["id", "isProtected"] });
    return !!target?.isProtected;
  }

  static async create(data: { title: string; description?: string; cycleId?: number; userId: number; dueDate?: string; status?: string }, viewer?: { id: number; role: string }) {
    // Protected accounts are invisible below super admin: block goal creation for them.
    if (await GoalController.isHiddenFrom(data.userId, viewer)) return null;
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

  static async update(id: number, data: { title?: string; description?: string; status?: string; dueDate?: string; progress?: number }, viewer?: { id: number; role: string }) {
    // Goals of protected accounts are invisible (and immutable) below super admin.
    const existing: any = await Goal.findByPk(id);
    if (!existing) return null;
    if (await GoalController.isHiddenFrom(existing.userId, viewer)) return null;
    const [count, rows] = await Goal.update(data, { where: { id }, returning: true });
    if (!rows[0]) return null;
    return GoalController.enrichGoal(rows[0]);
  }

  static async delete(id: number) {
    await Goal.destroy({ where: { id } });
  }
}
