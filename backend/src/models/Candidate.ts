import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class Candidate extends Model {
  declare id: number;
  declare jobId: number;
  declare firstName: string;
  declare surname: string;
  declare email: string;
  declare phone: string | null;
  declare resumeText: string | null;
  declare coverLetter: string | null;
  declare resumeUrl: string | null;
  declare applicationToken: string | null;
  declare source: string | null;
  declare address: string | null;
  declare city: string | null;
  declare experienceYears: number | null;
  declare currentEmployer: string | null;
  declare currentJobTitle: string | null;
  declare linkedin: string | null;
  declare expectedSalary: string | null;
  declare availableStartDate: string | null;
  declare education: string | null;
  declare stage: string;
  declare rating: number | null;
  declare notes: string | null;
  declare interviewDate: Date | null;
  declare interviewNotes: string | null;
  declare offerSalary: string | null;
  declare offerNotes: string | null;
  declare rejectionReason: string | null;
  declare hiredUserId: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Candidate.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    jobId: { type: DataTypes.INTEGER, allowNull: false, field: "job_id" },
    firstName: { type: DataTypes.TEXT, allowNull: false, field: "first_name" },
    surname: { type: DataTypes.TEXT, allowNull: false },
    email: { type: DataTypes.TEXT, allowNull: false },
    phone: { type: DataTypes.TEXT },
    resumeText: { type: DataTypes.TEXT, field: "resume_text" },
    coverLetter: { type: DataTypes.TEXT, field: "cover_letter" },
    resumeUrl: { type: DataTypes.TEXT, field: "resume_url" },
    applicationToken: { type: DataTypes.TEXT, field: "application_token" },
    source: { type: DataTypes.TEXT, defaultValue: "manual" },
    address: { type: DataTypes.TEXT },
    city: { type: DataTypes.TEXT },
    experienceYears: { type: DataTypes.INTEGER, field: "experience_years" },
    currentEmployer: { type: DataTypes.TEXT, field: "current_employer" },
    currentJobTitle: { type: DataTypes.TEXT, field: "current_job_title" },
    linkedin: { type: DataTypes.TEXT },
    expectedSalary: { type: DataTypes.TEXT, field: "expected_salary" },
    availableStartDate: { type: DataTypes.DATEONLY, field: "available_start_date" },
    education: { type: DataTypes.TEXT },
    stage: { type: DataTypes.TEXT, allowNull: false, defaultValue: "applied" },
    rating: { type: DataTypes.INTEGER },
    notes: { type: DataTypes.TEXT },
    interviewDate: { type: DataTypes.DATE, field: "interview_date" },
    interviewNotes: { type: DataTypes.TEXT, field: "interview_notes" },
    offerSalary: { type: DataTypes.TEXT, field: "offer_salary" },
    offerNotes: { type: DataTypes.TEXT, field: "offer_notes" },
    rejectionReason: { type: DataTypes.TEXT, field: "rejection_reason" },
    hiredUserId: { type: DataTypes.INTEGER, field: "hired_user_id" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "updated_at" },
  },
  { sequelize, tableName: "candidates", timestamps: false }
);

export default Candidate;
