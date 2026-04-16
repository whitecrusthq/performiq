import crypto from "crypto";
import { Op } from "sequelize";
import { JobRequisition, Candidate, Site, AppSettings, User } from "../models/index.js";
import { sendRecruitmentNotification } from "../lib/mailgun.js";
import { getUploadURL } from "../lib/storage.js";

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract",
  intern: "Internship", temporary: "Temporary",
};

export default class CareersController {
  static async getCompanyInfo() {
    const settings = await AppSettings.findOne({ where: { id: 1 } });
    return {
      companyName: settings?.companyName || "Our Company",
      logoLetter: settings?.logoLetter || "C",
      primaryHsl: settings?.primaryHsl || "221 83% 53%",
    };
  }

  static async listJobs() {
    const jobs = await JobRequisition.findAll({
      where: { status: "open" },
      attributes: ["id", "title", "department", "siteId", "description", "requirements", "employmentType", "openings", "closingDate", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    const sites = await Site.findAll();
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    return jobs.map(j => {
      const plain = j.get({ plain: true });
      return {
        ...plain,
        siteName: plain.siteId ? siteMap[plain.siteId] || null : null,
      };
    });
  }

  static async getJob(id: number) {
    const job = await JobRequisition.findOne({
      where: { id, status: "open" },
      attributes: ["id", "title", "department", "siteId", "description", "requirements", "employmentType", "openings", "closingDate", "createdAt"],
    });

    if (!job) return null;

    let siteName = null;
    if (job.siteId) {
      const site = await Site.findByPk(job.siteId);
      siteName = site?.name || null;
    }

    return { ...job.get({ plain: true }), siteName };
  }

  static async getUploadUrl() {
    return getUploadURL();
  }

  static async apply(jobId: number, data: any) {
    const job = await JobRequisition.findOne({
      where: { id: jobId, status: "open" },
    });
    if (!job) return { error: "Job not found or no longer accepting applications", status: 404 };

    const {
      firstName, surname, email, phone, coverLetter, resumeUrl,
      address, city, experienceYears, currentEmployer, currentJobTitle,
      linkedin, expectedSalary, availableStartDate, education,
    } = data;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { error: "Please provide a valid email address", status: 400 };
    }

    const existing = await Candidate.findOne({
      where: { jobId, email: email.toLowerCase().trim() },
      attributes: ["id"],
    });
    if (existing) {
      return { error: "You have already applied for this position", status: 409 };
    }

    const applicationToken = crypto.randomBytes(24).toString("hex");

    const candidate = await Candidate.create({
      jobId,
      firstName: firstName.trim(),
      surname: surname.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || null,
      coverLetter: coverLetter?.trim() || null,
      resumeUrl: resumeUrl || null,
      applicationToken,
      source: "careers_portal",
      address: address?.trim() || null,
      city: city?.trim() || null,
      experienceYears: experienceYears ? Number(experienceYears) : null,
      currentEmployer: currentEmployer?.trim() || null,
      currentJobTitle: currentJobTitle?.trim() || null,
      linkedin: linkedin?.trim() || null,
      expectedSalary: expectedSalary?.trim() || null,
      availableStartDate: availableStartDate || null,
      education: education?.trim() || null,
      stage: "applied",
    });

    sendRecruitmentNotification({
      event: "new_candidate",
      to: email.toLowerCase().trim(),
      recipientName: `${firstName} ${surname}`,
      candidateName: `${firstName} ${surname}`,
      jobTitle: job.title,
      department: job.department || undefined,
    }).catch(err => console.error("[careers] confirmation email error:", err));

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
        }).catch(err => console.error("[careers] manager notify error:", err));
      }
    }

    return {
      data: {
        message: "Application submitted successfully",
        applicationToken,
        candidate: {
          id: candidate.id,
          firstName: candidate.firstName,
          surname: candidate.surname,
          email: candidate.email,
          stage: candidate.stage,
          jobTitle: job.title,
        },
      },
    };
  }

  static async getApplication(token: string) {
    const candidate = await Candidate.findOne({ where: { applicationToken: token } });
    if (!candidate) return null;

    const job = await JobRequisition.findOne({
      where: { id: candidate.jobId },
      attributes: ["title", "department", "employmentType", "status"],
    });

    const stageTimeline = [
      { stage: "applied", label: "Application Received", description: "Your application has been received and is being reviewed." },
      { stage: "screening", label: "Screening", description: "Your qualifications are being reviewed by our hiring team." },
      { stage: "interview", label: "Interview", description: "You have been selected for an interview." },
      { stage: "offer", label: "Offer", description: "A job offer is being prepared for you." },
      { stage: "hired", label: "Hired", description: "Congratulations! You have been hired." },
    ];

    const currentIndex = stageTimeline.findIndex(s => s.stage === candidate.stage);
    const isRejected = candidate.stage === "rejected";

    return {
      candidate: {
        firstName: candidate.firstName,
        surname: candidate.surname,
        email: candidate.email,
        stage: candidate.stage,
        appliedAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      },
      job: job ? {
        title: job.title,
        department: job.department,
        employmentType: EMPLOYMENT_TYPE_LABEL[job.employmentType] || job.employmentType,
      } : null,
      timeline: stageTimeline.map((s, i) => ({
        ...s,
        status: isRejected ? (i <= currentIndex ? "completed" : "pending") :
                i < currentIndex ? "completed" :
                i === currentIndex ? "current" : "pending",
      })),
      isRejected,
      rejectionReason: isRejected ? (candidate.rejectionReason || "Thank you for your interest. We have decided to move forward with other candidates.") : null,
    };
  }
}
