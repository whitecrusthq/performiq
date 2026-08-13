import { Cycle } from "../models/index.js";

const VALID_SCORING_MODES = ["managers_only", "combined", "two_way"] as const;
export type ScoringMode = (typeof VALID_SCORING_MODES)[number];

export interface CycleInput {
  name: string; startDate: string; endDate: string; status: string;
  scoringMode?: string;
  selfWeight?: number;
  upwardIncluded?: boolean;
}

function normalizeScoringFields(data: CycleInput): { error?: string; fields: Record<string, any> } {
  const fields: Record<string, any> = {};
  if (data.scoringMode !== undefined) {
    if (!VALID_SCORING_MODES.includes(data.scoringMode as ScoringMode)) {
      return { error: `Invalid scoring mode. Must be one of: ${VALID_SCORING_MODES.join(", ")}`, fields };
    }
    fields.scoringMode = data.scoringMode;
  }
  if (data.selfWeight !== undefined && data.selfWeight !== null) {
    const w = Number(data.selfWeight);
    if (!Number.isFinite(w) || w < 0 || w > 100) {
      return { error: "Self weight must be a number between 0 and 100", fields };
    }
    fields.selfWeight = Math.round(w);
  }
  if (data.upwardIncluded !== undefined && data.upwardIncluded !== null) {
    fields.upwardIncluded = !!data.upwardIncluded;
  }
  return { fields };
}

export default class CycleController {
  static async getAll() {
    return Cycle.findAll({ order: [["startDate", "ASC"]] });
  }

  static async getById(id: number) {
    return Cycle.findByPk(id);
  }

  static async create(data: CycleInput) {
    const { error, fields } = normalizeScoringFields(data);
    if (error) throw new Error(`VALIDATION:${error}`);
    return Cycle.create({ name: data.name, startDate: data.startDate, endDate: data.endDate, status: data.status, ...fields });
  }

  static async update(id: number, data: CycleInput) {
    const { error, fields } = normalizeScoringFields(data);
    if (error) throw new Error(`VALIDATION:${error}`);
    const updates: Record<string, any> = { ...fields };
    if (data.name !== undefined) updates.name = data.name;
    if (data.startDate !== undefined) updates.startDate = data.startDate;
    if (data.endDate !== undefined) updates.endDate = data.endDate;
    if (data.status !== undefined) updates.status = data.status;
    const [count, rows] = await Cycle.update(updates, { where: { id }, returning: true });
    return rows[0] ?? null;
  }

  static async delete(id: number) {
    await Cycle.destroy({ where: { id } });
  }
}
