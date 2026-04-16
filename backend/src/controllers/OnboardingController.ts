import { Op } from "sequelize";
import { WorkflowTemplate, TemplateTask, OnboardingWorkflow, WorkflowTask, OnboardingDocument, User } from "../models/index.js";
import sequelize from "../db/sequelize.js";
import { QueryTypes } from "sequelize";

export default class OnboardingController {
  static async enrichWorkflow(wf: OnboardingWorkflow) {
    const [employee, startedBy] = await Promise.all([
      User.findByPk(wf.employeeId),
      User.findByPk(wf.startedById),
    ]);
    const tasks = await WorkflowTask.findAll({
      where: { workflowId: wf.id },
      order: [["orderIndex", "ASC"]],
    });

    const assigneeIds = [...new Set(tasks.map(t => t.assigneeId).filter(Boolean))] as number[];
    const assignees = assigneeIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: assigneeIds } } })
      : [];
    const assigneeMap = Object.fromEntries(assignees.map(u => [u.id, u]));

    const completedByIds = [...new Set(tasks.map(t => t.completedById).filter(Boolean))] as number[];
    const completedByUsers = completedByIds.length > 0
      ? await User.findAll({ where: { id: { [Op.in]: completedByIds } } })
      : [];
    const completedByMap = Object.fromEntries(completedByUsers.map(u => [u.id, u]));

    const enrichedTasks = tasks.map(t => ({
      ...t.get({ plain: true }),
      assignee: t.assigneeId ? assigneeMap[t.assigneeId] ?? null : null,
      completedBy: t.completedById ? completedByMap[t.completedById] ?? null : null,
    }));

    const total = tasks.length;
    const done = tasks.filter(t => t.status === "completed" || t.status === "skipped").length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    return {
      ...wf.get({ plain: true }),
      employee: employee ?? null,
      startedBy: startedBy ?? null,
      tasks: enrichedTasks,
      progress,
      totalTasks: total,
      completedTasks: done,
    };
  }

  static async listTemplates() {
    const templates = await WorkflowTemplate.findAll({ order: [["createdAt", "ASC"]] });
    const result = await Promise.all(templates.map(async t => {
      const tasks = await TemplateTask.findAll({
        where: { templateId: t.id },
        order: [["orderIndex", "ASC"]],
      });
      return { ...t.get({ plain: true }), tasks };
    }));
    return result;
  }

  static async createTemplate(data: { name: string; type: string; description?: string; tasks?: any[]; createdById: number }) {
    const { name, type, description, tasks = [], createdById } = data;
    const tmpl = await WorkflowTemplate.create({
      name, type, description: description || null,
      createdById,
    });
    if (tasks.length > 0) {
      await TemplateTask.bulkCreate(
        tasks.map((t: any, i: number) => ({
          templateId: tmpl.id,
          title: t.title,
          description: t.description || null,
          category: t.category || null,
          orderIndex: i,
          defaultAssigneeRole: t.defaultAssigneeRole || null,
          dueInDays: t.dueInDays ?? null,
        }))
      );
    }
    const allTasks = await TemplateTask.findAll({
      where: { templateId: tmpl.id },
      order: [["orderIndex", "ASC"]],
    });
    return { ...tmpl.get({ plain: true }), tasks: allTasks };
  }

  static async updateTemplate(id: number, data: { name?: string; description?: string; tasks?: any[] }) {
    const { name, description, tasks } = data;
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    const [count, rows] = await WorkflowTemplate.update(updates, { where: { id }, returning: true });
    if (count === 0) return null;
    const updated = rows[0];

    if (Array.isArray(tasks)) {
      await TemplateTask.destroy({ where: { templateId: id } });
      if (tasks.length > 0) {
        await TemplateTask.bulkCreate(
          tasks.map((t: any, i: number) => ({
            templateId: id,
            title: t.title,
            description: t.description || null,
            category: t.category || null,
            orderIndex: i,
            defaultAssigneeRole: t.defaultAssigneeRole || null,
            dueInDays: t.dueInDays ?? null,
          }))
        );
      }
    }
    const allTasks = await TemplateTask.findAll({
      where: { templateId: id },
      order: [["orderIndex", "ASC"]],
    });
    return { ...updated.get({ plain: true }), tasks: allTasks };
  }

  static async deleteTemplate(id: number) {
    await WorkflowTemplate.destroy({ where: { id } });
  }

  static async listWorkflows(filters: { type?: string; status?: string; employeeId?: number; userRole?: string; userId?: number }) {
    let rows = await OnboardingWorkflow.findAll({ order: [["createdAt", "ASC"]] });
    let plain = rows.map(r => r);
    if (filters.type) plain = plain.filter(w => w.type === filters.type);
    if (filters.status) plain = plain.filter(w => w.status === filters.status);
    if (filters.employeeId) plain = plain.filter(w => w.employeeId === filters.employeeId);
    if (filters.userRole === "employee") {
      plain = plain.filter(w => w.employeeId === filters.userId);
    }
    return Promise.all(plain.map(w => OnboardingController.enrichWorkflow(w)));
  }

  static async createWorkflow(data: any) {
    const { employeeId, templateId, type, title, notes, targetCompletionDate, tasks = [], probationDays, startedById } = data;

    const wf = await OnboardingWorkflow.create({
      employeeId: parseInt(employeeId),
      templateId: templateId ? parseInt(templateId) : null,
      type,
      title,
      notes: notes || null,
      startedById,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
    });

    if (type === "onboarding" && probationDays && parseInt(probationDays) > 0) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(probationDays));
      await User.update({
        probationEndDate: endDate.toISOString().split("T")[0],
        probationStatus: "active",
      }, { where: { id: parseInt(employeeId) } });
    }

    let taskSource = tasks;
    if (taskSource.length === 0 && templateId) {
      const templateTasks = await TemplateTask.findAll({
        where: { templateId: parseInt(templateId) },
        order: [["orderIndex", "ASC"]],
      });
      taskSource = templateTasks.map(t => ({
        title: t.title,
        description: t.description,
        category: t.category,
        orderIndex: t.orderIndex,
        dueInDays: t.dueInDays,
      }));
    }

    if (taskSource.length > 0) {
      await WorkflowTask.bulkCreate(
        taskSource.map((t: any, i: number) => ({
          workflowId: wf.id,
          title: t.title,
          description: t.description || null,
          category: t.category || null,
          orderIndex: t.orderIndex ?? i,
          assigneeId: t.assigneeId ? parseInt(t.assigneeId) : null,
          dueDate: t.dueInDays != null
            ? new Date(Date.now() + t.dueInDays * 86400000)
            : (t.dueDate ? new Date(t.dueDate) : null),
        }))
      );
    }

    return OnboardingController.enrichWorkflow(wf);
  }

  static async getWorkflow(id: number, userRole: string, userId: number) {
    const wf = await OnboardingWorkflow.findByPk(id);
    if (!wf) return { error: "Not found", status: 404 };
    if (userRole === "employee" && wf.employeeId !== userId) {
      return { error: "Forbidden", status: 403 };
    }
    return { data: await OnboardingController.enrichWorkflow(wf) };
  }

  static async updateWorkflow(id: number, data: { title?: string; notes?: string; status?: string; targetCompletionDate?: string }) {
    const { title, notes, status, targetCompletionDate } = data;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
      updates.status = status;
      if (status === "completed") updates.completedAt = new Date();
    }
    if (targetCompletionDate !== undefined)
      updates.targetCompletionDate = targetCompletionDate ? new Date(targetCompletionDate) : null;
    const [count, rows] = await OnboardingWorkflow.update(updates, { where: { id }, returning: true });
    if (count === 0) return null;
    return OnboardingController.enrichWorkflow(rows[0]);
  }

  static async deleteWorkflow(id: number) {
    await OnboardingWorkflow.destroy({ where: { id } });
  }

  static async updateTask(id: number, data: any, userId: number) {
    const { status, assigneeId, notes, title, description, category, dueDate } = data;
    const updates: any = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) updates.assigneeId = assigneeId ? parseInt(assigneeId) : null;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) {
      updates.status = status;
      if (status === "completed") {
        updates.completedAt = new Date();
        updates.completedById = userId;
      } else {
        updates.completedAt = null;
        updates.completedById = null;
      }
    }

    const [count, rows] = await WorkflowTask.update(updates, { where: { id }, returning: true });
    if (count === 0) return null;
    const updated = rows[0];

    const allTasks = await WorkflowTask.findAll({ where: { workflowId: updated.workflowId } });
    const allDone = allTasks.every(t => t.status === "completed" || t.status === "skipped");
    if (allDone) {
      await OnboardingWorkflow.update(
        { status: "completed", completedAt: new Date(), updatedAt: new Date() },
        { where: { id: updated.workflowId } }
      );
    }

    const wf = await OnboardingWorkflow.findByPk(updated.workflowId);
    return OnboardingController.enrichWorkflow(wf!);
  }

  static async addTaskToWorkflow(workflowId: number, data: any) {
    const { title, description, category, assigneeId, dueDate, notes } = data;

    const existingTasks = await WorkflowTask.findAll({ where: { workflowId } });
    const maxOrder = existingTasks.length > 0
      ? Math.max(...existingTasks.map(t => t.orderIndex)) + 1
      : 0;

    await WorkflowTask.create({
      workflowId,
      title,
      description: description || null,
      category: category || null,
      orderIndex: maxOrder,
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    });

    const wf = await OnboardingWorkflow.findByPk(workflowId);
    if (!wf) return null;
    return OnboardingController.enrichWorkflow(wf);
  }

  static async deleteTask(id: number) {
    const task = await WorkflowTask.findByPk(id);
    if (!task) return { error: "Not found" };
    await WorkflowTask.destroy({ where: { id } });
    const wf = await OnboardingWorkflow.findByPk(task.workflowId);
    if (!wf) return { success: true };
    return { data: await OnboardingController.enrichWorkflow(wf) };
  }

  static async listDocuments(workflowId: number) {
    const docs = await sequelize.query(
      `SELECT d.id, d.workflow_id AS "workflowId", d.name, d.file_type AS "fileType", d.notes, d.created_at AS "createdAt", d.uploaded_by_id AS "uploadedById", u.name AS "uploadedByName"
       FROM onboarding_documents d
       LEFT JOIN users u ON d.uploaded_by_id = u.id
       WHERE d.workflow_id = :workflowId
       ORDER BY d.created_at DESC`,
      { replacements: { workflowId }, type: QueryTypes.SELECT }
    );
    return docs;
  }

  static async downloadDocument(docId: number) {
    const doc = await OnboardingDocument.findByPk(docId);
    if (!doc) return null;
    return { fileData: doc.fileData, fileType: doc.fileType, name: doc.name };
  }

  static async createDocument(workflowId: number, data: { name: string; fileData?: string; fileType?: string; notes?: string; uploadedById: number; uploadedByName: string }) {
    const doc = await OnboardingDocument.create({
      workflowId,
      name: data.name.trim(),
      fileData: data.fileData || null,
      fileType: data.fileType || null,
      notes: data.notes || null,
      uploadedById: data.uploadedById,
    });
    return { ...doc.get({ plain: true }), uploadedByName: data.uploadedByName };
  }

  static async deleteDocument(docId: number) {
    await OnboardingDocument.destroy({ where: { id: docId } });
  }

  static async updateProbation(userId: number, action: string, extendDays?: number) {
    const user = await User.findByPk(userId);
    if (!user) return { error: "User not found", status: 404 };

    if (action === "confirm") {
      await User.update({ probationStatus: "confirmed" }, { where: { id: userId } });
    } else if (action === "fail") {
      await User.update({ probationStatus: "failed" }, { where: { id: userId } });
    } else if (action === "extend") {
      const days = extendDays || 30;
      const currentEnd = user.probationEndDate ? new Date(user.probationEndDate) : new Date();
      const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
      newEnd.setDate(newEnd.getDate() + days);
      await User.update({
        probationEndDate: newEnd.toISOString().split("T")[0],
        probationStatus: "extended",
      }, { where: { id: userId } });
    }

    const updated = await User.findByPk(userId);
    return { data: { probationEndDate: updated!.probationEndDate, probationStatus: updated!.probationStatus } };
  }
}
