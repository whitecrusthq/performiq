import { createRequire } from "module";
import fs from "node:fs";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import "dotenv/config";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

function createPool() {
  if (process.env.DATABASE_URL) {
    const databaseUrl = process.env.DATABASE_URL;
    const isLocalDatabase = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

    return new Pool({
      connectionString: databaseUrl,
      ssl: isLocalDatabase ? undefined : { require: true, rejectUnauthorized: false },
    });
  }

  const getRequiredDbEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      console.error(`${name} environment variable is required`);
      process.exit(1);
    }
    return value;
  };

  const dbHost = getRequiredDbEnv("DB_HOST");
  const dbPortRaw = process.env.DB_PORT || "5432";
  const dbPort = Number(dbPortRaw);
  const dbUser = getRequiredDbEnv("DB_USER");
  const dbPassword = process.env.DB_PASSWORD;
  const dbName = getRequiredDbEnv("DB_NAME");
  const dbSslModeRaw = process.env.DB_SSL_MODE || "disable";
  const dbSslEnabled = dbSslModeRaw === "require";
  const dbSslCaPath = process.env.DB_SSL_CA_PATH;

  if (Number.isNaN(dbPort) || dbPort <= 0) {
    console.error(`DB_PORT must be a positive number. Received: "${dbPortRaw}"`);
    process.exit(1);
  }

  const resolveCaPath = (certificatePath: string): string | undefined => {
    if (path.isAbsolute(certificatePath)) {
      return certificatePath;
    }

    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(process.cwd(), certificatePath),
      path.resolve(scriptDir, "..", certificatePath),
      path.resolve(scriptDir, certificatePath),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate));
  };

  const resolvedDbSslCaPath = dbSslCaPath
    ? resolveCaPath(dbSslCaPath) || dbSslCaPath
    : undefined;
  const dbSslCa = resolvedDbSslCaPath
    ? fs.readFileSync(resolvedDbSslCaPath, "utf8")
    : undefined;

  return new Pool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: dbSslEnabled
      ? {
        ca: dbSslCa,
        rejectUnauthorized: Boolean(dbSslCa),
      }
      : undefined,
  });
}

const pool = createPool();

async function seed() {
  try {
    const hash = await bcrypt.hash("password", 10);

    const users = [
      { name: "Admin User", email: "admin@performiq.com", role: "admin", dept: "Management", title: "System Administrator" },
      { name: "Sarah Chen", email: "sarah@performiq.com", role: "manager", dept: "Engineering", title: "Engineering Manager" },
      { name: "James Wright", email: "james@performiq.com", role: "manager", dept: "Product", title: "Product Manager" },
      { name: "Alice Johnson", email: "alice@performiq.com", role: "employee", dept: "Engineering", title: "Senior Engineer" },
      { name: "Bob Martinez", email: "bob@performiq.com", role: "employee", dept: "Engineering", title: "Software Engineer" },
      { name: "Carol Lee", email: "carol@performiq.com", role: "employee", dept: "Product", title: "Product Designer" },
      { name: "David Kim", email: "david@performiq.com", role: "employee", dept: "Product", title: "Product Analyst" },
    ];

    const ids: Record<string, number> = {};
    for (const u of users) {
      const r = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, department, job_title) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (email) DO UPDATE SET name=$1, password_hash=$3, role=$4 RETURNING id, email`,
        [u.name, u.email, hash, u.role, u.dept, u.title],
      );
      ids[u.email] = r.rows[0].id;
    }

    await pool.query(`UPDATE users SET manager_id=$1 WHERE id IN ($2,$3)`, [ids["sarah@performiq.com"], ids["alice@performiq.com"], ids["bob@performiq.com"]]);
    await pool.query(`UPDATE users SET manager_id=$1 WHERE id IN ($2,$3)`, [ids["james@performiq.com"], ids["carol@performiq.com"], ids["david@performiq.com"]]);

    await pool.query(`INSERT INTO cycles (name, start_date, end_date, status) VALUES
      ('Annual Review 2025','2025-01-01','2025-12-31','active'),
      ('Q1 Review 2025','2025-01-01','2025-03-31','closed'),
      ('Mid-Year 2025','2025-07-01','2025-09-30','draft')
      ON CONFLICT DO NOTHING`);

    const {
      rows: [{ id: cycleId }],
    } = await pool.query(`SELECT id FROM cycles WHERE status='active' LIMIT 1`);

    await pool.query(`INSERT INTO criteria (name, description, category, weight) VALUES
      ('Communication','Communicates clearly and effectively','Core Competencies',1.5),
      ('Teamwork','Collaborates effectively with others','Core Competencies',1.5),
      ('Problem Solving','Analyzes and solves complex problems','Technical Skills',2),
      ('Code Quality','Writes clean maintainable code','Technical Skills',2),
      ('Initiative','Takes ownership and drives outcomes','Leadership',1.5),
      ('Mentoring','Supports growth of peers','Leadership',1),
      ('Delivery','Meets commitments on time','Performance',2)
      ON CONFLICT DO NOTHING`);

    const { rows: critRows } = await pool.query(`SELECT id FROM criteria`);
    const critIds = critRows.map((r: any) => r.id);

    for (const [empEmail, status] of [
      ["alice@performiq.com", "self_review"],
      ["bob@performiq.com", "manager_review"],
    ] as const) {
      const empId = ids[empEmail];
      const mgId = ids["sarah@performiq.com"];
      const ex = await pool.query(`SELECT id FROM appraisals WHERE cycle_id=$1 AND employee_id=$2`, [cycleId, empId]);
      if (ex.rows.length === 0) {
        const {
          rows: [{ id: apprId }],
        } = await pool.query(
          `INSERT INTO appraisals (cycle_id, employee_id, reviewer_id, status) VALUES ($1,$2,$3,$4) RETURNING id`,
          [cycleId, empId, mgId, status],
        );
        for (const cId of critIds) {
          await pool.query(
            `INSERT INTO appraisal_scores (appraisal_id, criterion_id, self_score, self_note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [apprId, cId, status === "manager_review" ? 3 + Math.round(Math.random() * 2) : null, status === "manager_review" ? "Good progress" : null],
          );
        }
      }
    }

    const carolId = ids["carol@performiq.com"];
    const jamesId = ids["james@performiq.com"];
    const ex2 = await pool.query(`SELECT id FROM appraisals WHERE cycle_id=$1 AND employee_id=$2`, [cycleId, carolId]);
    if (ex2.rows.length === 0) {
      const {
        rows: [{ id: apprId }],
      } = await pool.query(
        `INSERT INTO appraisals (cycle_id, employee_id, reviewer_id, status, overall_score, self_comment, manager_comment) VALUES ($1,$2,$3,'completed',4.2,$4,$5) RETURNING id`,
        [cycleId, carolId, jamesId, "Delivered great work this cycle.", "Excellent performance. Strong design skills."],
      );
      for (const cId of critIds) {
        await pool.query(
          `INSERT INTO appraisal_scores (appraisal_id, criterion_id, self_score, manager_score) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
          [apprId, cId, 4, 4 + Math.round(Math.random())],
        );
      }
    }

    const goals = [
      [ids["alice@performiq.com"], cycleId, "Complete AWS certification", "Obtain Solutions Architect cert", "in_progress", null, 60],
      [ids["alice@performiq.com"], cycleId, "Refactor auth module", "Improve security and performance", "completed", null, 100],
      [ids["bob@performiq.com"], cycleId, "Learn TypeScript advanced patterns", "Study and apply TS patterns", "in_progress", null, 40],
      [ids["carol@performiq.com"], cycleId, "Redesign onboarding flow", "Improve user onboarding", "not_started", "2025-09-30", 0],
      [ids["sarah@performiq.com"], cycleId, "Q3 Team performance reviews", "Complete all team reviews", "in_progress", "2025-09-15", 50],
      [ids["david@performiq.com"], cycleId, "Customer research report", "Conduct user interviews", "in_progress", "2025-08-31", 70],
    ];

    for (const [uid, cid, title, desc, status, due, progress] of goals) {
      await pool.query(
        `INSERT INTO goals (user_id, cycle_id, title, description, status, due_date, progress) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [uid, cid, title, desc, status, due, progress],
      );
    }

    await pool.end();
    console.log("Seeded successfully!");
    console.log('Demo accounts (all password: "password"):');
    console.log("  admin@performiq.com  — Admin");
    console.log("  sarah@performiq.com  — Manager (Engineering)");
    console.log("  james@performiq.com  — Manager (Product)");
    console.log("  alice@performiq.com  — Employee (Engineering)");
    console.log("  bob@performiq.com    — Employee (Engineering)");
    console.log("  carol@performiq.com  — Employee (Product)");
    console.log("  david@performiq.com  — Employee (Product)");
  } catch (e: any) {
    console.error("Seed error:", e.message);
    await pool.end();
    process.exit(1);
  }
}

seed();
