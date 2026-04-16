import { Op } from "sequelize";
import { User, Site, StaffReminder } from "../models/index.js";

export default class AnniversaryController {
  static computeDateInfo(dateStr: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);

    const years = Math.floor((today.getTime() - d.getTime()) / (365.25 * 86400000));

    const nextDate = new Date(d);
    nextDate.setFullYear(today.getFullYear());
    if (nextDate < today) {
      nextDate.setFullYear(today.getFullYear() + 1);
    }
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / 86400000);
    const sameDay = nextDate.getMonth() === today.getMonth() && nextDate.getDate() === today.getDate();

    return {
      years,
      nextDate: nextDate.toISOString().split("T")[0],
      daysUntil: sameDay ? 0 : daysUntil,
      isToday: sameDay,
    };
  }

  static async listAnniversaries() {
    const users = await User.findAll({
      where: { startDate: { [Op.ne]: null } },
      attributes: ["id", "name", "department", "jobTitle", "startDate", "profilePhoto", "siteId"],
    });

    const sites = await Site.findAll();
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    return users.map(u => {
      const info = AnniversaryController.computeDateInfo(u.startDate!);
      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        startDate: u.startDate,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        yearsOfService: info.years,
        nextAnniversary: info.nextDate,
        daysUntilAnniversary: info.daysUntil,
        isToday: info.isToday,
      };
    });
  }

  static async listBirthdays() {
    const users = await User.findAll({
      where: { dateOfBirth: { [Op.ne]: null } },
      attributes: ["id", "name", "department", "jobTitle", "dateOfBirth", "profilePhoto", "siteId"],
    });

    const sites = await Site.findAll();
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    return users.map(u => {
      const info = AnniversaryController.computeDateInfo(u.dateOfBirth!);
      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        dateOfBirth: u.dateOfBirth,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        age: info.years,
        turningAge: info.years + (info.isToday ? 0 : 1),
        nextBirthday: info.nextDate,
        daysUntilBirthday: info.daysUntil,
        isToday: info.isToday,
      };
    });
  }

  static async listWeddings() {
    const users = await User.findAll({
      where: { weddingDate: { [Op.ne]: null } },
      attributes: ["id", "name", "department", "jobTitle", "weddingDate", "spouseName", "profilePhoto", "siteId"],
    });

    const sites = await Site.findAll();
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    return users.map(u => {
      const info = AnniversaryController.computeDateInfo(u.weddingDate!);
      return {
        id: u.id,
        name: u.name,
        department: u.department,
        jobTitle: u.jobTitle,
        weddingDate: u.weddingDate,
        spouseName: u.spouseName,
        profilePhoto: u.profilePhoto,
        site: u.siteId ? siteMap[u.siteId] ?? null : null,
        yearsMarried: info.years,
        nextAnniversary: info.nextDate,
        daysUntilAnniversary: info.daysUntil,
        isToday: info.isToday,
      };
    });
  }

  static async listReminders() {
    const reminders = await StaffReminder.findAll();

    const userIds = [...new Set(reminders.filter(r => r.userId).map(r => r.userId!))];
    let userMap: Record<number, { name: string; department: string | null; jobTitle: string | null; profilePhoto: string | null }> = {};
    if (userIds.length > 0) {
      const users = await User.findAll({
        attributes: ["id", "name", "department", "jobTitle", "profilePhoto"],
      });
      users.forEach(u => { userMap[u.id] = { name: u.name, department: u.department, jobTitle: u.jobTitle, profilePhoto: u.profilePhoto }; });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = reminders.map(r => {
      const rDate = new Date(r.reminderDate);
      rDate.setHours(0, 0, 0, 0);

      let nextDate: Date;
      let daysUntil: number;
      let isToday = false;

      if (r.recurring) {
        nextDate = new Date(rDate);
        nextDate.setFullYear(today.getFullYear());
        if (nextDate < today) {
          nextDate.setFullYear(today.getFullYear() + 1);
        }
        const sameDay = nextDate.getMonth() === today.getMonth() && nextDate.getDate() === today.getDate();
        daysUntil = sameDay ? 0 : Math.ceil((nextDate.getTime() - today.getTime()) / 86400000);
        isToday = sameDay;
      } else {
        nextDate = rDate;
        const sameDay = rDate.getMonth() === today.getMonth() && rDate.getDate() === today.getDate() && rDate.getFullYear() === today.getFullYear();
        daysUntil = sameDay ? 0 : Math.ceil((rDate.getTime() - today.getTime()) / 86400000);
        isToday = sameDay;
      }

      const user = r.userId ? userMap[r.userId] : null;

      return {
        id: r.id,
        title: r.title,
        reminderType: r.reminderType,
        reminderDate: r.reminderDate,
        recurring: r.recurring,
        notes: r.notes,
        userId: r.userId,
        userName: user?.name ?? null,
        userDepartment: user?.department ?? null,
        userJobTitle: user?.jobTitle ?? null,
        userProfilePhoto: user?.profilePhoto ?? null,
        nextDate: nextDate.toISOString().split("T")[0],
        daysUntil,
        isToday,
        isPast: !r.recurring && daysUntil < 0,
      };
    });

    return enriched.filter(r => !r.isPast).sort((a, b) => a.daysUntil - b.daysUntil);
  }

  static async createReminder(data: any, createdById: number) {
    const { title, reminderType, reminderDate, recurring, notes, userId } = data;
    const reminder = await StaffReminder.create({
      title,
      reminderType: reminderType || "other",
      reminderDate,
      recurring: recurring !== false,
      notes: notes || null,
      userId: userId || null,
      createdById,
    });
    return reminder;
  }

  static async updateReminder(id: number, data: any) {
    const { title, reminderType, reminderDate, recurring, notes, userId } = data;
    const [count, rows] = await StaffReminder.update({
      title,
      reminderType: reminderType || "other",
      reminderDate,
      recurring: recurring !== false,
      notes: notes || null,
      userId: userId || null,
    }, { where: { id }, returning: true });

    if (count === 0) return null;
    return rows[0];
  }

  static async deleteReminder(id: number) {
    const count = await StaffReminder.destroy({ where: { id } });
    return count > 0;
  }
}
