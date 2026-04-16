import { Op } from "sequelize";
import { JobRequisition, Candidate, User, Site, WorkflowTemplate, TemplateTask, OnboardingWorkflow, WorkflowTask } from "../models/index.js";
import bcrypt from "bcryptjs";
import { sendRecruitmentNotification, sendCandidateNotification, type CandidateNotifyEvent } from "../lib/mailgun.js";
import sequelize from "../db/sequelize.js";

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

export default class RecruitmentController {
  static async enrichJob(job: JobRequisition) {
    const userIds = [job.createdById, ...(job.hiringManagerId ? [job.hiringManagerId] : [])];
    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "name"],
    });
    const userMap: Record<number, string> = {};
    users.forEach(u => { userMap[u.id] = u.name; });

    let site = null;
    if (job.siteId) {
      site = await Site.findByPk(job.siteId);
      site = site ? site.get({ plain: true }) : null;
    }

    const candidates = await Candidate.findAll({ where: { jobId: job.id } });
    const stageCounts: Record<string, number> = {};
    STAGES.forEach(s => { stageCounts[s] = 0; });
    candidates.forEach(c => { stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1; });

    return {
      ...job.get({ plain: true }),
      createdByName: userMap[job.createdById] ?? null,
      hiringManagerName: job.hiringManagerId ? (userMap[job.hiringManagerId] ?? null) : null,
      site,
      candidateCount: candidates.length,
      stageCounts,
    };
  }

  static async listJobs() {
    const rows = await JobRequisition.findAll({ order: [["createdAt", "DESC"]] });
    return Promise.all(rows.map(r => RecruitmentController.enrichJob(r)));
  }

  static async createJob(data: any, createdById: number) {
    const { title, department, siteId, description, requirements, employmentType, openings, hiringManagerId, closingDate, status } = data;
    const row = await JobRequisition.create({
      title,
      department: department || null,
      siteId: siteId ? Number(siteId) : null,
      description: description || null,
      requirements: requirements || null,
      employmentType: employmentType || "full_time",
      status: status || "draft",
      openings: openings ? Number(openings) : 1,
      hiringManagerId: hiringManagerId ? Number(hiringManagerId) : null,
      createdById,
      closingDate: closingDate || null,
    });
    return RecruitmentController.enrichJob(row);
  }

  static async updateJob(id: number, data: any, userId: number) {
    const existing = await JobRequisition.findByPk(id);
    const previousStatus = existing?.status;

    const { title, department, siteId, description, requirements, employmentType, status, openings, hiringManagerId, closingDate } = data;

    const [count, rows] = await JobRequisition.update({
      ...(title !== undefined && { title }),
      ...(department !== undefined && { department: department || null }),
      ...(siteId !== undefined && { siteId: siteId ? Number(siteId) : null }),
      ...(description !== undefined && { description: description || null }),
      ...(requirements !== undefined && { requirements: requirements || null }),
      ...(employmentType !== undefined && { employmentType }),
      ...(status !== undefined && { status }),
      ...(openings !== undefined && { openings: Number(openings) }),
      ...(hiringManagerId !== undefined && { hiringManagerId: hiringManagerId ? Number(hiringManagerId) : null }),
      ...(closingDate !== undefined && { closingDate: closingDate || null }),
      updatedAt: new Date(),
    }, { where: { id }, returning: true });

    if (count === 0) return null;
    const row = rows[0];

    if (status && status !== previousStatus && row.hiringManagerId) {
      const manager = await User.findOne({
        where: { id: row.hiringManagerId },
        attributes: ["name", "email"],
      });
      if (manager) {
        const event = (status === "open") ? "job_opened" as const : (status === "closed" || status === "filled") ? "job_closed" as const : null;
        if (event) {
          sendRecruitmentNotification({
            event,
            to: manager.email,
            recipientName: manager.name,
            jobTitle: row.title,
            department: row.department || undefined,
          }).catch(err => console.error("[recruitment notify] job status error:", err));
        }
      }
    }

    return RecruitmentController.enrichJob(row);
  }

  static async deleteJob(id: number) {
    await JobRequisition.destroy({ where: { id } });
  }

  static async listCandidates(jobId: number) {
    return Candidate.findAll({
      where: { jobId },
      order: [["createdAt", "DESC"]],
    });
  }

  static async createCandidate(jobId: number, data: any) {
    const { firstName, surname, email, phone, resumeText, coverLetter, notes } = data;

    const job = await JobRequisition.findByPk(jobId);
    if (!job) return { error: "Job not found", status: 404 };

    const row = await Candidate.create({
      jobId,
      firstName,
      surname,
      email,
      phone: phone || null,
      resumeText: resumeText || null,
      coverLetter: coverLetter || null,
      notes: notes || null,
      stage: "applied",
    });

    if (job.hiringManagerId) {
      const manager = await User.findOne({
        where: { id: job.hiringManagerId },
        attributes: ["name", "email"],
      });
      if (manager) {
        sendRecruitmentNotification({
          event: "new_candidate",
          to: manager.email,
          recipientName: manager.name,
          candidateName: `${firstName} ${surname}`,
          jobTitle: job.title,
          department: job.department || undefined,
        }).catch(err => console.error("[recruitment notify] new_candidate error:", err));
      }
    }

    return { data: row };
  }

  static async updateCandidate(id: number, data: any) {
    const { stage, rating, notes, interviewDate, interviewNotes, offerSalary, offerNotes, rejectionReason, firstName, surname, email, phone } = data;

    const existing = await Candidate.findByPk(id);
    if (!existing) return { error: "Not found", status: 404 };

    const previousStage = existing.stage;
    const updates: any = { updatedAt: new Date() };
    if (stage !== undefined) updates.stage = stage;
    if (rating !== undefined) updates.rating = rating;
    if (notes !== undefined) updates.notes = notes;
    if (interviewDate !== undefined) updates.interviewDate = interviewDate ? new Date(interviewDate) : null;
    if (interviewNotes !== undefined) updates.interviewNotes = interviewNotes;
    if (offerSalary !== undefined) updates.offerSalary = offerSalary;
    if (offerNotes !== undefined) updates.offerNotes = offerNotes;
    if (rejectionReason !== undefined) updates.rejectionReason = rejectionReason;
    if (firstName !== undefined) updates.firstName = firstName;
    if (surname !== undefined) updates.surname = surname;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;

    const [, rows] = await Candidate.update(updates, { where: { id }, returning: true });
    const row = rows[0];

    if (stage !== undefined && stage !== previousStage) {
      const job = await JobRequisition.findByPk(existing.jobId);
      if (job?.hiringManagerId) {
        const manager = await User.findOne({
          where: { id: job.hiringManagerId },
          attributes: ["name", "email"],
        });
        if (manager) {
          sendRecruitmentNotification({
            event: "stage_change",
            to: manager.email,
            recipientName: manager.name,
            candidateName: `${existing.firstName} ${existing.surname}`,
            jobTitle: job.title,
            department: job.department || undefined,
            stage,
            previousStage,
          }).catch(err => console.error("[recruitment notify] stage_change error:", err));
        }
      }

      const candidateEventMap: Record<string, CandidateNotifyEvent> = {
        screening: "moved_to_screening",
        interview: "interview_scheduled",
        offer: "offer_extended",
        rejected: "application_rejected",
      };
      const candidateEvent = candidateEventMap[stage];
      if (candidateEvent && job) {
        sendCandidateNotification({
          event: candidateEvent,
          to: existing.email,
          candidateName: `${existing.firstName} ${existing.surname}`,
          jobTitle: job.title,
          department: job.department || undefined,
          interviewDate: stage === "interview" && interviewDate ? new Date(interviewDate).toLocaleDateString() : undefined,
          rejectionReason: stage === "rejected" ? rejectionReason : undefined,
        }).catch(err => console.error("[recruitment notify] candidate email error:", err));
      }
    }

    return { data: row };
  }

  static async deleteCandidate(id: number) {
    await Candidate.destroy({ where: { id } });
  }

  static async hireCandidate(id: number, body: any, currentUser: { id: number; name?: string }) {
    const candidate = await Candidate.findByPk(id);
    if (!candidate) return { error: "Candidate not found", status: 404 };
    if (candidate.stage === "hired") return { error: "Candidate already hired", status: 400 };

    const job = await JobRequisition.findByPk(candidate.jobId);
    if (!job) return { error: "Job not found", status: 404 };

    const existingUser = await User.findOne({ where: { email: candidate.email }, attributes: ["id"] });
    if (existingUser) return { error: "A user with this email already exists", status: 400 };

    const passwordHash = await bcrypt.hash("changeme123", 10);
    const startDate = body.startDate || new Date().toISOString().split("T")[0];
    const probationDays = body.probationDays ? Number(body.probationDays) : null;

    let probationEndDate = null;
    if (probationDays && probationDays > 0) {
      const pEnd = new Date(startDate);
      pEnd.setDate(pEnd.getDate() + probationDays);
      probationEndDate = pEnd.toISOString().split("T")[0];
    }

    const newUser = await User.create({
      name: `${candidate.firstName} ${candidate.surname}`,
      firstName: candidate.firstName,
      surname: candidate.surname,
      email: candidate.email,
      phone: candidate.phone,
      passwordHash,
      role: "employee",
      department: job.department || null,
      jobTitle: job.title,
      siteId: job.siteId || null,
      startDate,
      ...(probationEndDate && { probationEndDate, probationStatus: "active" }),
    });

    await Candidate.update({
      stage: "hired",
      hiredUserId: newUser.id,
      updatedAt: new Date(),
    }, { where: { id: candidate.id } });

    const hiredCount = await Candidate.count({
      where: { jobId: job.id, stage: "hired" },
    });
    if (hiredCount >= job.openings) {
      await JobRequisition.update(
        { status: "filled", updatedAt: new Date() },
        { where: { id: job.id } }
      );
    }

    let onboardingWorkflow = null;
    if (body.startOnboarding) {
      const template = await WorkflowTemplate.findOne({
        where: { type: "onboarding", isDefault: true },
      });

      const wf = await OnboardingWorkflow.create({
        employeeId: newUser.id,
        templateId: template?.id || null,
        type: "onboarding",
        title: `Onboarding - ${newUser.name}`,
        status: "active",
        notes: `Hired via recruitment for ${job.title}`,
        startedById: currentUser.id,
      });

      if (template) {
        const tmplTasks = await TemplateTask.findAll({
          where: { templateId: template.id },
        });
        for (const tt of tmplTasks) {
          let dueDate = null;
          if (tt.dueInDays) {
            const d = new Date();
            d.setDate(d.getDate() + tt.dueInDays);
            dueDate = d;
          }
          await WorkflowTask.create({
            workflowId: wf.id,
            title: tt.title,
            description: tt.description,
            category: tt.category,
            orderIndex: tt.orderIndex,
            dueDate,
            status: "pending",
          });
        }
      }

      onboardingWorkflow = wf;
    }

    sendCandidateNotification({
      event: "hired",
      to: candidate.email,
      candidateName: `${candidate.firstName} ${candidate.surname}`,
      jobTitle: job.title,
      department: job.department || undefined,
      startDate,
    }).catch(err => console.error("[recruitment notify] candidate_hired error:", err));

    if (job.hiringManagerId && job.hiringManagerId !== currentUser.id) {
      const manager = await User.findOne({
        where: { id: job.hiringManagerId },
        attributes: ["name", "email"],
      });
      if (manager) {
        sendRecruitmentNotification({
          event: "stage_change",
          to: manager.email,
          recipientName: manager.name,
          candidateName: `${candidate.firstName} ${candidate.surname}`,
          jobTitle: job.title,
          department: job.department || undefined,
          stage: "hired",
          previousStage: candidate.stage,
        }).catch(err => console.error("[recruitment notify] hire stage_change error:", err));
      }
    }

    return {
      data: {
        candidate: { ...candidate.get({ plain: true }), stage: "hired", hiredUserId: newUser.id },
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
        onboardingWorkflow,
      },
    };
  }
}
