import { Router } from "express";
import { db, jobRequisitionsTable, candidatesTable, usersTable, sitesTable, workflowsTable, workflowTemplatesTable, templateTasksTable, workflowTasksTable } from "../db/index.js";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole, AuthRequest } from "../middlewares/auth.js";
import bcrypt from "bcryptjs";

const router = Router();

const STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"] as const;

async function enrichJob(job: typeof jobRequisitionsTable.$inferSelect) {
  const userIds = [job.createdById, ...(job.hiringManagerId ? [job.hiringManagerId] : [])];
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap: Record<number, string> = {};
  users.forEach(u => { userMap[u.id] = u.name; });

  let site = null;
  if (job.siteId) {
    const [s] = await db.select().from(sitesTable).where(eq(sitesTable.id, job.siteId));
    site = s ?? null;
  }

  const candidates = await db.select().from(candidatesTable).where(eq(candidatesTable.jobId, job.id));
  const stageCounts: Record<string, number> = {};
  STAGES.forEach(s => { stageCounts[s] = 0; });
  candidates.forEach(c => { stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1; });

  return {
    ...job,
    createdByName: userMap[job.createdById] ?? null,
    hiringManagerName: job.hiringManagerId ? (userMap[job.hiringManagerId] ?? null) : null,
    site,
    candidateCount: candidates.length,
    stageCounts,
  };
}

router.get("/recruitment/jobs", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(jobRequisitionsTable).orderBy(desc(jobRequisitionsTable.createdAt));
    const enriched = await Promise.all(rows.map(enrichJob));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/recruitment/jobs", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { title, department, siteId, description, requirements, employmentType, openings, hiringManagerId, closingDate, status } = req.body;
    if (!title) { res.status(400).json({ error: "Title is required" }); return; }

    const [row] = await db.insert(jobRequisitionsTable).values({
      title,
      department: department || null,
      siteId: siteId ? Number(siteId) : null,
      description: description || null,
      requirements: requirements || null,
      employmentType: employmentType || "full_time",
      status: status || "draft",
      openings: openings ? Number(openings) : 1,
      hiringManagerId: hiringManagerId ? Number(hiringManagerId) : null,
      createdById: req.user!.id,
      closingDate: closingDate || null,
    }).returning();

    res.status(201).json(await enrichJob(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/recruitment/jobs/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { title, department, siteId, description, requirements, employmentType, status, openings, hiringManagerId, closingDate } = req.body;
    const [row] = await db.update(jobRequisitionsTable).set({
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
    }).where(eq(jobRequisitionsTable.id, Number(req.params.id))).returning();

    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await enrichJob(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/recruitment/jobs/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    await db.delete(jobRequisitionsTable).where(eq(jobRequisitionsTable.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/recruitment/jobs/:jobId/candidates", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(candidatesTable)
      .where(eq(candidatesTable.jobId, Number(req.params.jobId)))
      .orderBy(desc(candidatesTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/recruitment/jobs/:jobId/candidates", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const { firstName, surname, email, phone, resumeText, coverLetter, notes } = req.body;
    if (!firstName || !surname || !email) {
      res.status(400).json({ error: "firstName, surname, and email are required" }); return;
    }

    const [row] = await db.insert(candidatesTable).values({
      jobId: Number(req.params.jobId),
      firstName,
      surname,
      email,
      phone: phone || null,
      resumeText: resumeText || null,
      coverLetter: coverLetter || null,
      notes: notes || null,
      stage: "applied",
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/recruitment/candidates/:id", requireAuth, requireRole("admin", "manager"), async (req: AuthRequest, res) => {
  try {
    const { stage, rating, notes, interviewDate, interviewNotes, offerSalary, offerNotes, rejectionReason, firstName, surname, email, phone } = req.body;
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

    const [row] = await db.update(candidatesTable).set(updates)
      .where(eq(candidatesTable.id, Number(req.params.id))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/recruitment/candidates/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    await db.delete(candidatesTable).where(eq(candidatesTable.id, Number(req.params.id)));
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/recruitment/candidates/:id/hire", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, Number(req.params.id)));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (candidate.stage === "hired") { res.status(400).json({ error: "Candidate already hired" }); return; }

    const [job] = await db.select().from(jobRequisitionsTable).where(eq(jobRequisitionsTable.id, candidate.jobId));
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    const existingUser = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, candidate.email));
    if (existingUser.length > 0) { res.status(400).json({ error: "A user with this email already exists" }); return; }

    const passwordHash = await bcrypt.hash("changeme123", 10);
    const startDate = req.body.startDate || new Date().toISOString().split("T")[0];
    const probationDays = req.body.probationDays ? Number(req.body.probationDays) : null;

    let probationEndDate = null;
    if (probationDays && probationDays > 0) {
      const pEnd = new Date(startDate);
      pEnd.setDate(pEnd.getDate() + probationDays);
      probationEndDate = pEnd.toISOString().split("T")[0];
    }

    const [newUser] = await db.insert(usersTable).values({
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
    }).returning();

    await db.update(candidatesTable).set({
      stage: "hired",
      hiredUserId: newUser.id,
      updatedAt: new Date(),
    }).where(eq(candidatesTable.id, candidate.id));

    const hiredCount = await db.select({ count: sql<number>`count(*)` }).from(candidatesTable)
      .where(and(eq(candidatesTable.jobId, job.id), eq(candidatesTable.stage, "hired")));
    const totalHired = Number(hiredCount[0]?.count || 0);
    if (totalHired >= job.openings) {
      await db.update(jobRequisitionsTable).set({ status: "filled", updatedAt: new Date() })
        .where(eq(jobRequisitionsTable.id, job.id));
    }

    let onboardingWorkflow = null;
    if (req.body.startOnboarding) {
      const templates = await db.select().from(workflowTemplatesTable)
        .where(and(eq(workflowTemplatesTable.type, "onboarding"), eq(workflowTemplatesTable.isDefault, true)));
      const template = templates[0];

      const [wf] = await db.insert(workflowsTable).values({
        employeeId: newUser.id,
        templateId: template?.id || null,
        type: "onboarding",
        title: `Onboarding - ${newUser.name}`,
        status: "active",
        notes: `Hired via recruitment for ${job.title}`,
        startedById: req.user!.id,
      }).returning();

      if (template) {
        const tmplTasks = await db.select().from(templateTasksTable)
          .where(eq(templateTasksTable.templateId, template.id));
        for (const tt of tmplTasks) {
          let dueDate = null;
          if (tt.dueInDays) {
            const d = new Date();
            d.setDate(d.getDate() + tt.dueInDays);
            dueDate = d;
          }
          await db.insert(workflowTasksTable).values({
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

    res.json({
      candidate: { ...candidate, stage: "hired", hiredUserId: newUser.id },
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
      onboardingWorkflow,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
