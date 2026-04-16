import { Site } from "../models/index.js";

export default class SiteController {
  static async listAll() {
    return Site.findAll({ order: [["name", "ASC"]] });
  }

  static async create(data: { name: string; address?: string; city?: string; region?: string; country?: string; description?: string }) {
    return Site.create({
      name: data.name.trim(),
      address: data.address,
      city: data.city,
      region: data.region,
      country: data.country,
      description: data.description,
    });
  }

  static async update(id: number, data: { name: string; address?: string; city?: string; region?: string; country?: string; description?: string }) {
    const [count, rows] = await Site.update(
      { name: data.name.trim(), address: data.address, city: data.city, region: data.region, country: data.country, description: data.description },
      { where: { id }, returning: true }
    );
    if (count === 0) return null;
    return rows[0];
  }

  static async delete(id: number) {
    await Site.destroy({ where: { id } });
  }
}
