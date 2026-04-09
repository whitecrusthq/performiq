import { Router, Request, Response } from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { Product, ProductCategory, ProductSource } from "../models/index.js";

const router = Router();

router.get("/products", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { search, categoryId, minPrice, maxPrice, inStock, page = "1", limit = "20" } = req.query;
    const where: Record<string, unknown> = { isActive: true };

    if (search) {
      where[Op.or as unknown as string] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (categoryId) where.categoryId = Number(categoryId);
    if (minPrice) where.price = { ...((where.price as object) || {}), [Op.gte]: Number(minPrice) };
    if (maxPrice) where.price = { ...((where.price as object) || {}), [Op.lte]: Number(maxPrice) };
    if (inStock === "true") where.stockQty = { [Op.gt]: 0 };

    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [
        { model: ProductCategory, as: "category", attributes: ["id", "name"] },
        { model: ProductSource, as: "source", attributes: ["id", "name"] },
      ],
      order: [["name", "ASC"]],
      limit: Number(limit),
      offset,
    });

    res.json({ products: rows, total: count, page: Number(page), totalPages: Math.ceil(count / Number(limit)) });
  } catch (err: any) {
    console.error("GET /products error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/products/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: ProductCategory, as: "category", attributes: ["id", "name"] },
        { model: ProductSource, as: "source", attributes: ["id", "name"] },
      ],
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/products", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/products/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    await product.update(req.body);
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/products/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    await product.destroy();
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/product-categories", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await ProductCategory.findAll({ order: [["name", "ASC"]] });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/product-categories", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const category = await ProductCategory.create(req.body);
    res.status(201).json(category);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/product-categories/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cat = await ProductCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    await cat.update(req.body);
    res.json(cat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/product-categories/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ProductCategory.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/product-sources", requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const sources = await ProductSource.findAll({ order: [["name", "ASC"]] });
    const safe = sources.map((s) => {
      const json = s.toJSON() as Record<string, unknown>;
      if (json.apiKey) json.apiKey = "••••••";
      if (json.webhookSecret) json.webhookSecret = "••••••";
      if (json.headerValue) json.headerValue = "••••••";
      return json;
    });
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/product-sources", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (req.body.type === "webhook" && !req.body.webhookSecret) {
      req.body.webhookSecret = crypto.randomBytes(32).toString("hex");
    }
    const source = await ProductSource.create(req.body);
    res.status(201).json(source);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/product-sources/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const source = await ProductSource.findByPk(req.params.id);
    if (!source) return res.status(404).json({ error: "Source not found" });
    const updates = { ...req.body };
    if (updates.apiKey === "••••••") delete updates.apiKey;
    if (updates.webhookSecret === "••••••") delete updates.webhookSecret;
    if (updates.headerValue === "••••••") delete updates.headerValue;
    await source.update(updates);
    res.json(source);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/product-sources/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ProductSource.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/product-sources/:id/sync", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const source = await ProductSource.findByPk(req.params.id);
    if (!source) return res.status(404).json({ error: "Source not found" });
    if (!source.apiUrl) return res.status(400).json({ error: "No API URL configured" });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (source.apiKey) headers["Authorization"] = `Bearer ${source.apiKey}`;
    if (source.headerKey && source.headerValue) headers[source.headerKey] = source.headerValue;

    const response = await fetch(source.apiUrl, { headers });
    if (!response.ok) {
      await source.update({ lastSyncAt: new Date(), lastSyncStatus: "error" });
      return res.status(400).json({ error: `API returned ${response.status}` });
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : data.products || data.items || data.data || [];
    const mapping = source.fieldMapping || {};

    let imported = 0;
    for (const item of items) {
      const externalId = String(item[mapping.id || "id"] || item.id || "");
      const productData = {
        externalId,
        name: item[mapping.name || "name"] || item.title || "Unknown",
        description: item[mapping.description || "description"] || null,
        sku: item[mapping.sku || "sku"] || null,
        price: parseFloat(item[mapping.price || "price"]) || 0,
        currency: item[mapping.currency || "currency"] || "USD",
        imageUrl: item[mapping.imageUrl || "image_url"] || item.image || item.imageUrl || null,
        stockQty: item[mapping.stockQty || "stock"] != null ? parseInt(item[mapping.stockQty || "stock"]) : null,
        sourceId: source.id,
        isActive: true,
      };

      if (externalId) {
        const [product, created] = await Product.findOrCreate({
          where: { externalId, sourceId: source.id },
          defaults: productData,
        });
        if (!created) await product.update(productData);
      } else {
        await Product.create(productData);
      }
      imported++;
    }

    await source.update({
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      lastSyncCount: imported,
    });

    res.json({ imported, total: items.length });
  } catch (err: any) {
    console.error("Sync error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/product-webhook/:secret", async (req: Request, res: Response) => {
  try {
    const source = await ProductSource.findOne({
      where: { webhookSecret: req.params.secret, type: "webhook", isActive: true },
    });
    if (!source) return res.status(404).json({ error: "Invalid webhook" });

    const payload = req.body;
    const event = payload.event || payload.action || "upsert";
    const items = payload.products || payload.items || payload.data || (payload.product ? [payload.product] : [payload]);
    const mapping = source.fieldMapping || {};

    let processed = 0;
    for (const item of items) {
      const externalId = String(item[mapping.id || "id"] || item.id || "");
      if (!externalId) continue;

      if (event === "delete" || event === "removed") {
        await Product.destroy({ where: { externalId, sourceId: source.id } });
        processed++;
        continue;
      }

      const productData = {
        externalId,
        name: item[mapping.name || "name"] || item.title || "Unknown",
        description: item[mapping.description || "description"] || null,
        sku: item[mapping.sku || "sku"] || null,
        price: parseFloat(item[mapping.price || "price"]) || 0,
        currency: item[mapping.currency || "currency"] || "USD",
        imageUrl: item[mapping.imageUrl || "image_url"] || item.image || item.imageUrl || null,
        stockQty: item[mapping.stockQty || "stock"] != null ? parseInt(item[mapping.stockQty || "stock"]) : null,
        sourceId: source.id,
        isActive: true,
      };

      const [product, created] = await Product.findOrCreate({
        where: { externalId, sourceId: source.id },
        defaults: productData,
      });
      if (!created) await product.update(productData);
      processed++;
    }

    await source.update({
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      lastSyncCount: processed,
    });

    res.json({ processed });
  } catch (err: any) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
