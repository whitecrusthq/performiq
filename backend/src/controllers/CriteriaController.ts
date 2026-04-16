import { Criterion, CriteriaGroup, CriteriaGroupItem } from "../models/index.js";

export default class CriteriaController {
  static async getAll() {
    return Criterion.findAll({ order: [["category", "ASC"], ["name", "ASC"]] });
  }

  static async create(data: { name: string; description?: string; category: string; weight: string; type?: string; targetValue?: string | null; unit?: string | null; targetPeriod?: string | null }) {
    return Criterion.create({
      name: data.name,
      description: data.description,
      category: data.category,
      weight: data.weight,
      type: data.type ?? "rating",
      targetValue: data.targetValue ?? null,
      unit: data.unit ?? null,
      targetPeriod: data.targetPeriod ?? null,
    });
  }

  static async update(id: number, data: { name: string; description?: string; category: string; weight: string; type?: string; targetValue?: string | null; unit?: string | null; targetPeriod?: string | null }) {
    const [count, rows] = await Criterion.update({
      name: data.name,
      description: data.description,
      category: data.category,
      weight: data.weight,
      type: data.type ?? "rating",
      targetValue: data.targetValue ?? null,
      unit: data.unit ?? null,
      targetPeriod: data.targetPeriod ?? null,
    }, { where: { id }, returning: true });
    return rows[0] ?? null;
  }

  static async delete(id: number) {
    await CriteriaGroupItem.destroy({ where: { criterionId: id } });
    await Criterion.destroy({ where: { id } });
  }

  static async getAllGroups() {
    const groups = await CriteriaGroup.findAll({ order: [["name", "ASC"]] });
    const items = await CriteriaGroupItem.findAll();
    const allCriteria = await Criterion.findAll();
    const criteriaMap = new Map(allCriteria.map((c: any) => [c.id, c.get({ plain: true })]));

    return groups.map((g: any) => {
      const gPlain = g.get({ plain: true });
      return {
        ...gPlain,
        criteria: items
          .filter((i: any) => i.groupId === gPlain.id)
          .map((i: any) => criteriaMap.get(i.criterionId))
          .filter(Boolean),
      };
    });
  }

  static async createGroup(data: { name: string; description?: string; criteriaIds?: number[] }) {
    const group = await CriteriaGroup.create({ name: data.name, description: data.description });
    if (data.criteriaIds?.length) {
      await CriteriaGroupItem.bulkCreate(
        data.criteriaIds.map((cid: number) => ({ groupId: (group as any).id, criterionId: cid })),
        { ignoreDuplicates: true }
      );
    }
    return group;
  }

  static async updateGroup(id: number, data: { name: string; description?: string; criteriaIds?: number[] }) {
    const [count, rows] = await CriteriaGroup.update(
      { name: data.name, description: data.description },
      { where: { id }, returning: true }
    );
    if (!rows[0]) return null;

    await CriteriaGroupItem.destroy({ where: { groupId: id } });
    if (data.criteriaIds?.length) {
      await CriteriaGroupItem.bulkCreate(
        data.criteriaIds.map((cid: number) => ({ groupId: id, criterionId: cid })),
        { ignoreDuplicates: true }
      );
    }
    return rows[0];
  }

  static async deleteGroup(id: number) {
    await CriteriaGroupItem.destroy({ where: { groupId: id } });
    await CriteriaGroup.destroy({ where: { id } });
  }
}
