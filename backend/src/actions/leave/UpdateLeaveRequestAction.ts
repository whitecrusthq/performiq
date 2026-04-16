import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.js";
import LeaveController from "../../controllers/LeaveController.js";
import { sendLeaveNotification } from "../../lib/mailgun.js";

function notify(payload: Parameters<typeof sendLeaveNotification>[0]) {
  sendLeaveNotification(payload).catch(err =>
    console.error("[leave notify] Failed to send notification:", err?.message ?? err)
  );
}

export class UpdateLeaveRequestAction {
  static async handle(req: AuthRequest, res: Response) {
    try {
      const { role, id } = req.user!;
      const { status, reviewNote } = req.body;

      const result = await LeaveController.updateLeaveRequest(Number(req.params.id), id, role, { status, reviewNote });

      if ("error" in result && !("data" in result)) {
        res.status(result.status).json({ error: result.error }); return;
      }

      if ("notifyEvent" in result && result.empUser) {
        const empUser = result.empUser as any;
        const row = result.row as any;
        const employeeName = empUser?.name ?? empUser?.email ?? "An employee";

        if (result.notifyEvent === "rejected") {
          if (empUser?.email) {
            notify({
              event: "rejected",
              to: empUser.email,
              recipientName: empUser.name ?? empUser.email,
              employeeName,
              leaveType: row.leaveType,
              startDate: row.startDate,
              endDate: row.endDate,
              days: row.days,
              reviewerNote: result.reviewNote || undefined,
            });
          }
        } else if (result.notifyEvent === "approved") {
          if (empUser?.email) {
            notify({
              event: "approved",
              to: empUser.email,
              recipientName: empUser.name ?? empUser.email,
              employeeName,
              leaveType: row.leaveType,
              startDate: row.startDate,
              endDate: row.endDate,
              days: row.days,
              reviewerNote: result.reviewNote || undefined,
            });
          }
        } else if (result.notifyEvent === "awaiting_next" && result.nextApprover) {
          const nextApprover = result.nextApprover as any;
          if (nextApprover?.email) {
            notify({
              event: "awaiting_next",
              to: nextApprover.email,
              recipientName: nextApprover.name ?? nextApprover.email,
              employeeName,
              leaveType: row.leaveType,
              startDate: row.startDate,
              endDate: row.endDate,
              days: row.days,
            });
          }
        }
      }

      res.json(result.data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
}
