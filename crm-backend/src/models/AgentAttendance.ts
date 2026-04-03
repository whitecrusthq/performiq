import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/database.js";

export interface AgentAttendanceAttributes {
  id: number;
  agentId: number;
  date: string;
  clockIn: Date | null;
  clockOut: Date | null;
  durationMinutes: number | null;
  clockInLat: string | null;
  clockInLng: string | null;
  clockOutLat: string | null;
  clockOutLng: string | null;
  faceImageIn: string | null;
  faceImageOut: string | null;
  clockInPhotoTime: Date | null;
  clockOutPhotoTime: Date | null;
  notes: string | null;
  faceReviewStatus: "pending" | "verified" | "flagged";
  faceReviewedBy: number | null;
  faceReviewedAt: Date | null;
  shiftStartExpected: string | null;
  shiftGraceMinutes: number | null;
  clockInDiffMinutes: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AgentAttendanceCreationAttributes
  extends Optional<
    AgentAttendanceAttributes,
    | "id"
    | "clockIn"
    | "clockOut"
    | "durationMinutes"
    | "clockInLat"
    | "clockInLng"
    | "clockOutLat"
    | "clockOutLng"
    | "faceImageIn"
    | "faceImageOut"
    | "clockInPhotoTime"
    | "clockOutPhotoTime"
    | "notes"
    | "faceReviewStatus"
    | "faceReviewedBy"
    | "faceReviewedAt"
    | "shiftStartExpected"
    | "shiftGraceMinutes"
    | "clockInDiffMinutes"
  > {}

export class AgentAttendance
  extends Model<AgentAttendanceAttributes, AgentAttendanceCreationAttributes>
  implements AgentAttendanceAttributes
{
  declare id: number;
  declare agentId: number;
  declare date: string;
  declare clockIn: Date | null;
  declare clockOut: Date | null;
  declare durationMinutes: number | null;
  declare clockInLat: string | null;
  declare clockInLng: string | null;
  declare clockOutLat: string | null;
  declare clockOutLng: string | null;
  declare faceImageIn: string | null;
  declare faceImageOut: string | null;
  declare clockInPhotoTime: Date | null;
  declare clockOutPhotoTime: Date | null;
  declare notes: string | null;
  declare faceReviewStatus: "pending" | "verified" | "flagged";
  declare faceReviewedBy: number | null;
  declare faceReviewedAt: Date | null;
  declare shiftStartExpected: string | null;
  declare shiftGraceMinutes: number | null;
  declare clockInDiffMinutes: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AgentAttendance.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    agentId: { type: DataTypes.INTEGER, allowNull: false, field: "agent_id" },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    clockIn: { type: DataTypes.DATE, allowNull: true, field: "clock_in" },
    clockOut: { type: DataTypes.DATE, allowNull: true, field: "clock_out" },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: true, field: "duration_minutes" },
    clockInLat: { type: DataTypes.STRING(30), allowNull: true, field: "clock_in_lat" },
    clockInLng: { type: DataTypes.STRING(30), allowNull: true, field: "clock_in_lng" },
    clockOutLat: { type: DataTypes.STRING(30), allowNull: true, field: "clock_out_lat" },
    clockOutLng: { type: DataTypes.STRING(30), allowNull: true, field: "clock_out_lng" },
    faceImageIn: { type: DataTypes.TEXT, allowNull: true, field: "face_image_in" },
    faceImageOut: { type: DataTypes.TEXT, allowNull: true, field: "face_image_out" },
    clockInPhotoTime: { type: DataTypes.DATE, allowNull: true, field: "clock_in_photo_time" },
    clockOutPhotoTime: { type: DataTypes.DATE, allowNull: true, field: "clock_out_photo_time" },
    notes: { type: DataTypes.TEXT, allowNull: true },
    faceReviewStatus: {
      type: DataTypes.ENUM("pending", "verified", "flagged"),
      allowNull: false,
      defaultValue: "pending",
      field: "face_review_status",
    },
    faceReviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: "face_reviewed_by" },
    faceReviewedAt: { type: DataTypes.DATE, allowNull: true, field: "face_reviewed_at" },
    shiftStartExpected: { type: DataTypes.STRING(5), allowNull: true, field: "shift_start_expected" },
    shiftGraceMinutes: { type: DataTypes.INTEGER, allowNull: true, field: "shift_grace_minutes" },
    clockInDiffMinutes: { type: DataTypes.INTEGER, allowNull: true, field: "clock_in_diff_minutes" },
  },
  {
    sequelize,
    tableName: "crm_agent_attendance",
    underscored: true,
  }
);
