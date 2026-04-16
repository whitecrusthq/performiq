import { Router } from "express";
import crypto from "crypto";
import { db, jobRequisitionsTable, candidatesTable, sitesTable, appSettingsTable } from "../db/index.js";
import { eq, and, desc } from "drizzle-orm";
import { sendRecruitmentNotification } from "../lib/mailgun.js";
import { getUploadURL } from "../lib/storage.js";

const router = Router();

router.get("/careers/company", async (_req, res) => {
  try {
    const [settings] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1)).limit(1);
    res.json({
      companyName: settings?.companyName || "Our Company",
      logoLetter: settings?.logoLetter || "C",
      primaryHsl: settings?.primaryHsl || "221 83% 53%",
    });
  } catch {
    res.json({ companyName: "Our Company", logoLetter: "C", primaryHsl: "221 83% 53%" });
  }
});

router.get("/careers/jobs", async (_req, res) => {
  try {
    const jobs = await db.select({
      id: jobRequisitionsTable.id,
      title: jobRequisitionsTable.title,
      department: jobRequisitionsTable.department,
      siteId: jobRequisitionsTable.siteId,
      description: jobRequisitionsTable.description,
      requirements: jobRequisitionsTable.requirements,
      employmentType: jobRequisitionsTable.employmentType,
      openings: jobRequisitionsTable.openings,
      closingDate: jobRequisitionsTable.closingDate,
      createdAt: jobRequisitionsTable.createdAt,
    }).from(jobRequisitionsTable)
      .where(eq(jobRequisitionsTable.status, "open"))
      .orderBy(desc(jobRequisitionsTable.createdAt));

    const sites = await db.select().from(sitesTable);
    const siteMap: Record<number, string> = {};
    sites.forEach(s => { siteMap[s.id] = s.name; });

    const enriched = jobs.map(j => ({
      ...j,
      siteName: j.siteId ? siteMap[j.siteId] || null : null,
    }));

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/careers/jobs/:id", async (req, res) => {
  try {
    const [job] = await db.select({
      id: jobRequisitionsTable.id,
      title: jobRequisitionsTable.title,
      department: jobRequisitionsTable.department,
      siteId: jobRequisitionsTable.siteId,
      description: jobRequisitionsTable.description,
      requirements: jobRequisitionsTable.requirements,
      employmentType: jobRequisitionsTable.employmentType,
      openings: jobRequisitionsTable.openings,
      closingDate: jobRequisitionsTable.closingDate,
      createdAt: jobRequisitionsTable.createdAt,
    }).from(jobRequisitionsTable)
      .where(and(eq(jobRequisitionsTable.id, Number(req.params.id)), eq(jobRequisitionsTable.status, "open")));

    if (!job) { res.status(404).json({ error: "Job not found or no longer open" }); return; }

    let siteName = null;
    if (job.siteId) {
      const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, job.siteId));
      siteName = site?.name || null;
    }

    res.json({ ...job, siteName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/careers/upload-url", async (_req, res) => {
  try {
    const result = await getUploadURL();
    res.json(result);
  } catch (err: any) {
    console.error("Careers upload URL error:", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract",
  intern: "Internship", temporary: "Temporary",
};

router.post("/careers/apply/:jobId", async (req, res) => {
  try {
    const jobId = Number(req.params.jobId);
    const [job] = await db.select().from(jobRequisitionsTable)
      .where(and(eq(jobRequisitionsTable.id, jobId), eq(jobRequisitionsTable.status, "open")));
    if (!job) { res.status(404).json({ error: "Job not found or no longer accepting applications" }); return; }

    const {
      firstName, surname, email, phone, coverLetter, resumeUrl,
      address, city, experienceYears, currentEmployer, currentJobTitle,
      linkedin, expectedSalary, availableStartDate, education,
    } = req.body;

    if (!firstName || !surname || !email) {
      res.status(400).json({ error: "First name, surname, and email are required" }); return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Please provide a valid email address" }); return;
    }

    const existing = await db.select({ id: candidatesTable.id }).from(candidatesTable)
      .where(and(eq(candidatesTable.jobId, jobId), eq(candidatesTable.email, email.toLowerCase().trim())));
    if (existing.length > 0) {
      res.status(409).json({ error: "You have already applied for this position" }); return;
    }

    const applicationToken = crypto.randomBytes(24).toString("hex");

    const [candidate] = await db.insert(candidatesTable).values({
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
    }).returning();

    sendRecruitmentNotification({
      event: "new_candidate",
      to: email.toLowerCase().trim(),
      recipientName: `${firstName} ${surname}`,
      candidateName: `${firstName} ${surname}`,
      jobTitle: job.title,
      department: job.department || undefined,
    }).catch(err => console.error("[careers] confirmation email error:", err));

    if (job.hiringManagerId) {
      const usersTable = (await import("../db/index.js")).usersTable;
      const [manager] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable).where(eq(usersTable.id, job.hiringManagerId));
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

    res.status(201).json({
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/careers/application/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [candidate] = await db.select().from(candidatesTable)
      .where(eq(candidatesTable.applicationToken, token));
    if (!candidate) { res.status(404).json({ error: "Application not found" }); return; }

    const [job] = await db.select({
      title: jobRequisitionsTable.title,
      department: jobRequisitionsTable.department,
      employmentType: jobRequisitionsTable.employmentType,
      status: jobRequisitionsTable.status,
    }).from(jobRequisitionsTable).where(eq(jobRequisitionsTable.id, candidate.jobId));

    const stageTimeline = [
      { stage: "applied", label: "Application Received", description: "Your application has been received and is being reviewed." },
      { stage: "screening", label: "Screening", description: "Your qualifications are being reviewed by our hiring team." },
      { stage: "interview", label: "Interview", description: "You have been selected for an interview." },
      { stage: "offer", label: "Offer", description: "A job offer is being prepared for you." },
      { stage: "hired", label: "Hired", description: "Congratulations! You have been hired." },
    ];

    const currentIndex = stageTimeline.findIndex(s => s.stage === candidate.stage);
    const isRejected = candidate.stage === "rejected";

    res.json({
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
