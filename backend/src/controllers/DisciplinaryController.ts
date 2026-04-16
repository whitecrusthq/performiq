import { Op } from "sequelize";
import { DisciplinaryRecord, DisciplinaryAttachment, User } from "../models/index.js";

export default class DisciplinaryController {
  static async listRecords(userId: number) {
    const records = await DisciplinaryRecord.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    const recordIds = records.map(r => r.id);
    let attachments: DisciplinaryAttachment[] = [];
    if (recordIds.length > 0) {
      attachments = await DisciplinaryAttachment.findAll({
        where: { recordId: { [Op.in]: recordIds } },
      });
    }

    const creatorIds = [...new Set(records.map(r => r.createdById).filter(Boolean))] as number[];
    let creators: any[] = [];
    if (creatorIds.length > 0) {
      creators = await User.findAll({
        where: { id: { [Op.in]: creatorIds } },
        attributes: ["id", "name"],
      });
    }
    const creatorMap = Object.fromEntries(creators.map(c => [c.id, c.name]));

    return records.map(r => ({
      ...r.get({ plain: true }),
      createdByName: r.createdById ? creatorMap[r.createdById] || null : null,
      attachments: attachments.filter(a => a.recordId === r.id),
    }));
  }

  static async createRecord(userId: number, data: any, createdById: number, createdByName: string) {
    const { type, subject, description, sanctionApplied, severity, incidentDate, attachments } = data;

    const record = await DisciplinaryRecord.create({
      userId,
      type: type || "disciplinary",
      subject: subject.trim(),
      description: description?.trim() || null,
      sanctionApplied: sanctionApplied?.trim() || null,
      severity: severity || "minor",
      incidentDate: incidentDate || null,
      createdById,
    });

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      await DisciplinaryAttachment.bulkCreate(
        attachments.map((a: any) => ({
          recordId: record.id,
          fileName: a.fileName,
          fileType: a.fileType || "application/octet-stream",
          objectPath: a.objectPath,
          uploadedById: createdById,
        }))
      );
    }

    const allAttachments = await DisciplinaryAttachment.findAll({
      where: { recordId: record.id },
    });

    return {
      ...record.get({ plain: true }),
      createdByName,
      attachments: allAttachments,
    };
  }

  static async updateRecord(id: number, data: any) {
    const { type, subject, description, sanctionApplied, severity, incidentDate } = data;

    const [count, rows] = await DisciplinaryRecord.update({
      type: type || "disciplinary",
      subject: subject?.trim(),
      description: description?.trim() || null,
      sanctionApplied: sanctionApplied?.trim() || null,
      severity: severity || "minor",
      incidentDate: incidentDate || null,
      updatedAt: new Date(),
    }, { where: { id }, returning: true });

    if (count === 0) return null;
    return rows[0];
  }

  static async deleteRecord(id: number) {
    await DisciplinaryRecord.destroy({ where: { id } });
  }

  static async addAttachment(recordId: number, data: { fileName: string; fileType?: string; objectPath: string; uploadedById: number }) {
    const attachment = await DisciplinaryAttachment.create({
      recordId,
      fileName: data.fileName,
      fileType: data.fileType || "application/octet-stream",
      objectPath: data.objectPath,
      uploadedById: data.uploadedById,
    });
    return attachment;
  }

  static async deleteAttachment(attachmentId: number) {
    await DisciplinaryAttachment.destroy({ where: { id: attachmentId } });
  }
}
