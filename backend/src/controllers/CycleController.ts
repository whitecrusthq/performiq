import { Cycle } from "../models/index.js";

export default class CycleController {
  static async getAll() {
    return Cycle.findAll({ order: [["startDate", "ASC"]] });
  }

  static async getById(id: number) {
    return Cycle.findByPk(id);
  }

  static async create(data: { name: string; startDate: string; endDate: string; status: string }) {
    return Cycle.create(data);
  }

  static async update(id: number, data: { name: string; startDate: string; endDate: string; status: string }) {
    const [count, rows] = await Cycle.update(data, { where: { id }, returning: true });
    return rows[0] ?? null;
  }

  static async delete(id: number) {
    await Cycle.destroy({ where: { id } });
  }
}
