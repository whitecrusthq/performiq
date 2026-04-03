import { Router } from "express";
import authRouter from "./auth.js";
import conversationsRouter from "./conversations.js";
import customersRouter from "./customers.js";
import campaignsRouter from "./campaigns.js";
import agentsRouter from "./agents.js";
import dashboardRouter from "./dashboard.js";
import analyticsRouter from "./analytics.js";
import channelsRouter from "./channels.js";
import aiRouter from "./ai.js";
import webhooksRouter from "./webhooks.js";
import closedRouter from "./closed.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", service: "hira-crm" }));

router.use(webhooksRouter);

router.use(authRouter);
router.use(conversationsRouter);
router.use(customersRouter);
router.use(campaignsRouter);
router.use(agentsRouter);
router.use(dashboardRouter);
router.use(analyticsRouter);
router.use(channelsRouter);
router.use(aiRouter);
router.use(closedRouter);

export default router;
