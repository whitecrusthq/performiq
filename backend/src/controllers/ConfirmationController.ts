import { ConfirmationReview, User, Appraisal } from "../models/index.js";

export default class ConfirmationController {
  static async createReview(employeeId: number, initiatedBy: number, notes?: string) {
    const employee = await User.findByPk(employeeId);
    if (!employee) return { error: "Employee not found", status: 404 };

    const allReviews = await ConfirmationReview.findAll({ where: { employeeId } });
    const activeReview = allReviews.find(r => !["completed", "rejected"].includes(r.status));
    if (activeReview) {
      return { error: "A confirmation review is already in progress for this employee", status: 409, review: activeReview };
    }

    const review = await ConfirmationReview.create({
      employeeId,
      initiatedBy,
      status: "pending_appraisal",
      reviewerNotes: notes || null,
    });
    return { data: review };
  }

  static async getReviews(employeeId: number) {
    const reviews = await ConfirmationReview.findAll({
      where: { employeeId },
      order: [["createdAt", "DESC"]],
    });

    const active = reviews.find(r => !["completed", "rejected"].includes(r.status));
    let linkedAppraisal = null;
    if (active?.appraisalId) {
      linkedAppraisal = await Appraisal.findByPk(active.appraisalId) || null;
    }

    return { active, history: reviews, linkedAppraisal };
  }

  static async linkAppraisal(id: number, appraisalId: number) {
    const review = await ConfirmationReview.findByPk(id);
    if (!review) return { error: "Confirmation review not found", status: 404 };
    if (review.status === "completed" || review.status === "rejected") {
      return { error: "Review is already finalized", status: 400 };
    }

    const appraisal = await Appraisal.findByPk(appraisalId);
    if (!appraisal) return { error: "Appraisal not found", status: 404 };
    if (appraisal.employeeId !== review.employeeId) {
      return { error: "Appraisal does not belong to this employee", status: 400 };
    }

    const newStatus = appraisal.status === "completed"
      ? (review.reviewDocumentPath ? "pending_approval" : "pending_document")
      : "pending_appraisal";

    const [, rows] = await ConfirmationReview.update(
      { appraisalId, status: newStatus, updatedAt: new Date() },
      { where: { id }, returning: true }
    );
    return { data: rows[0] };
  }

  static async uploadDocument(id: number, documentPath: string, documentName?: string) {
    const review = await ConfirmationReview.findByPk(id);
    if (!review) return { error: "Confirmation review not found", status: 404 };
    if (review.status === "completed" || review.status === "rejected") {
      return { error: "Review is already finalized", status: 400 };
    }

    let newStatus = review.status;
    if (review.appraisalId) {
      const appraisal = await Appraisal.findByPk(review.appraisalId);
      if (appraisal && appraisal.status === "completed") {
        newStatus = "pending_approval";
      }
    }

    const [, rows] = await ConfirmationReview.update({
      reviewDocumentPath: documentPath,
      reviewDocumentName: documentName || "Review Document",
      status: newStatus,
      updatedAt: new Date(),
    }, { where: { id }, returning: true });
    return { data: rows[0] };
  }

  static async approve(id: number, approvedBy: number, notes?: string) {
    const review = await ConfirmationReview.findByPk(id);
    if (!review) return { error: "Confirmation review not found", status: 404 };
    if (review.status === "completed") return { error: "Already completed", status: 400 };
    if (review.status === "rejected") return { error: "Already rejected", status: 400 };

    if (review.appraisalId) {
      const appraisal = await Appraisal.findByPk(review.appraisalId);
      if (!appraisal || appraisal.status !== "completed") {
        return { error: "Linked appraisal must be completed before approval", status: 400 };
      }
    } else {
      return { error: "An appraisal must be linked before approval", status: 400 };
    }

    if (!review.reviewDocumentPath) {
      return { error: "A review document must be uploaded before approval", status: 400 };
    }

    const [, rows] = await ConfirmationReview.update({
      status: "completed",
      approvedBy,
      reviewerNotes: notes || review.reviewerNotes,
      updatedAt: new Date(),
    }, { where: { id }, returning: true });

    await User.update({ probationStatus: "confirmed" }, { where: { id: review.employeeId } });
    return { data: rows[0] };
  }

  static async reject(id: number, approvedBy: number, reason?: string) {
    const review = await ConfirmationReview.findByPk(id);
    if (!review) return { error: "Confirmation review not found", status: 404 };
    if (review.status === "completed" || review.status === "rejected") {
      return { error: "Review is already finalized", status: 400 };
    }

    const [, rows] = await ConfirmationReview.update({
      status: "rejected",
      rejectedReason: reason || null,
      approvedBy,
      updatedAt: new Date(),
    }, { where: { id }, returning: true });
    return { data: rows[0] };
  }

  static async refreshStatus(id: number) {
    const review = await ConfirmationReview.findByPk(id);
    if (!review) return { error: "Not found", status: 404 };

    if (review.appraisalId && (review.status === "pending_appraisal" || review.status === "pending_document")) {
      const appraisal = await Appraisal.findByPk(review.appraisalId);
      if (appraisal?.status === "completed" && review.reviewDocumentPath) {
        const [, rows] = await ConfirmationReview.update(
          { status: "pending_approval", updatedAt: new Date() },
          { where: { id }, returning: true }
        );
        return { data: rows[0] };
      } else if (appraisal?.status === "completed" && !review.reviewDocumentPath) {
        const [, rows] = await ConfirmationReview.update(
          { status: "pending_document", updatedAt: new Date() },
          { where: { id }, returning: true }
        );
        return { data: rows[0] };
      }
    }
    return { data: review };
  }
}
