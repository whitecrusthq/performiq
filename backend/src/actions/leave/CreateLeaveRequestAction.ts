import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";
import { sendLeaveNotification } from "../../lib/mailgun.js";

function notify(payload: Parameters<typeof sendLeaveNotification>[0]) {
  sendLeaveNotification(payload).catch(err =>
    console.error("[leave notify] Failed to send notification:", err?.message ?? err)
  );
}

export class CreateLeaveRequestAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { leaveType, startDate, endDate, days, reason, approverIds, coverUserIds } = req.body;
      if (!leaveType || !startDate || !endDate || !days) {
        res.status(400).json({ error: "leaveType, startDate, endDate, and days are required" }); return;
      }

      const result = await LeaveController.createLeaveRequest(req.user!.id, { leaveType, startDate, endDate, days, reason, approverIds, coverUserIds });

      if (result.orderedApproverIds.length > 0) {
        const firstApprover = result.userMap[result.orderedApproverIds[0]];
        const employee = result.userMap[req.user!.id];
        if (firstApprover?.email) {
          notify({
            event: "submitted",
            to: firstApprover.email,
            recipientName: firstApprover.name ?? firstApprover.email,
            employeeName: employee?.name ?? employee?.email ?? "An employee",
            leaveType: result.row.leaveType,
            startDate: result.row.startDate,
            endDate: result.row.endDate,
            days: result.row.days,
          });
        }
      }

      res.status(201).json(result.enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
