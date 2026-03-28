import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool } from "../db";

const HealthCheckResponse = z.object({
  status: z.string(),
  database: z.string(),
});

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("select 1");
    const data = HealthCheckResponse.parse({ status: "ok", database: "up" });
    res.json(data);
  } catch {
    const data = HealthCheckResponse.parse({ status: "error", database: "down" });
    res.status(503).json(data);
  }
});

export default router;
