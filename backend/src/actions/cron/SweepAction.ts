import { Request, Response } from "express";
import { verifyCronSecret } from "../../lib/cron-auth.js";
import { logger } from "../../lib/logger.js";
import AttendanceScheduleController from "../../controllers/AttendanceScheduleController.js";
import AppraisalController from "../../controllers/AppraisalController.js";

/**
 * Protected sweep endpoint meant to be hit by an external scheduled trigger
 * (Replit Scheduled Deployment, cron service, etc.) so time-based work still
 * runs when the autoscale deployment has scaled to zero and the in-process
 * ticker is not running. Guarded by the `SWEEP_SECRET` shared secret.
 */
export class SweepAction {
  static async handle(req: Request, res: Response) {
    const auth = verifyCronSecret(req);
    if (!auth.ok) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }

    try {
      const [autoClosed, activatedAppraisals] = await Promise.all([
        AttendanceScheduleController.runSweep(),
        AppraisalController.activateDueScheduled(),
      ]);
      if (autoClosed > 0 || activatedAppraisals > 0) {
        logger.info(
          { autoClosed, activatedAppraisals, source: "cron" },
          "External sweep processed pending work",
        );
      }
      res.json({ ok: true, autoClosed, activatedAppraisals });
    } catch (err) {
      logger.error({ err }, "External sweep failed");
      res.status(500).json({ error: "Sweep failed" });
    }
  }
}
