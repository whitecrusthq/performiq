import { Site } from "../models/index.js";

export default class SiteController {
  static async listAll() {
    return Site.findAll({ order: [["name", "ASC"]] });
  }

  static async create(data: { name: string; address?: string; city?: string; region?: string; country?: string; description?: string; require2Fa?: boolean }) {
    return Site.create({
      name: data.name.trim(),
      address: data.address,
      city: data.city,
      region: data.region,
      country: data.country,
      description: data.description,
      require2Fa: !!data.require2Fa,
    });
  }

  static async update(id: number, data: { name: string; address?: string; city?: string; region?: string; country?: string; description?: string; require2Fa?: boolean }) {
    const updates: Record<string, any> = {
      name: data.name.trim(), address: data.address, city: data.city, region: data.region, country: data.country, description: data.description,
    };
    if (typeof data.require2Fa === "boolean") updates.require2Fa = data.require2Fa;
    const [count, rows] = await Site.update(updates, { where: { id }, returning: true });
    if (count === 0) return null;
    return rows[0];
  }

  static async delete(id: number) {
    await Site.destroy({ where: { id } });
  }

  static async bulkImport(rows: any[]) {
    const existing = await Site.findAll();
    const existingNames = new Set(existing.map((s: Site) => s.name.trim().toLowerCase()));

    const results: { row: number; status: string; name?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      try {
        const name = (r.name ?? "").trim();
        if (!name) {
          results.push({ row: rowNum, status: "error", name: r.name, error: "Site name is required" });
          continue;
        }
        const key = name.toLowerCase();
        if (existingNames.has(key)) {
          results.push({ row: rowNum, status: "error", name, error: "Site name already exists" });
          continue;
        }

        const require2FaRaw = (r.require2Fa ?? r.require2fa ?? "").toString().trim().toLowerCase();
        const require2Fa = ["true", "yes", "y", "1"].includes(require2FaRaw);

        await Site.create({
          name,
          address: r.address?.trim() || null,
          city: r.city?.trim() || null,
          region: r.region?.trim() || null,
          country: r.country?.trim() || null,
          description: r.description?.trim() || null,
          require2Fa,
        });
        existingNames.add(key);
        results.push({ row: rowNum, status: "success", name });
      } catch (err: any) {
        const msg = err.original?.code === "23505" ? "Site name already exists" : (err.message || "Unknown error");
        results.push({ row: rowNum, status: "error", name: r.name, error: msg });
      }
    }

    const succeeded = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "error").length;
    return { total: rows.length, succeeded, failed, results };
  }
}
