import { DataTypes, Model } from "sequelize";
import sequelize from "../db/sequelize.js";

class User extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: string;
  declare customRoleId: number | null;
  declare managerId: number | null;
  declare siteId: number | null;
  declare department: string | null;
  declare jobTitle: string | null;
  declare phone: string | null;
  declare staffId: string | null;
  declare profilePhoto: string | null;
  declare isLocked: boolean;
  declare failedLoginAttempts: number;
  declare lockedAt: Date | null;
  declare createdAt: Date;
  declare surname: string | null;
  declare firstName: string | null;
  declare middleName: string | null;
  declare address: string | null;
  declare permanentAddress: string | null;
  declare permanentCity: string | null;
  declare permanentState: string | null;
  declare permanentCountry: string | null;
  declare permanentPostalCode: string | null;
  declare temporaryAddress: string | null;
  declare temporaryCity: string | null;
  declare temporaryState: string | null;
  declare temporaryCountry: string | null;
  declare temporaryPostalCode: string | null;
  declare city: string | null;
  declare stateProvince: string | null;
  declare country: string | null;
  declare postalCode: string | null;
  declare dateOfBirth: string | null;
  declare gender: string | null;
  declare maritalStatus: string | null;
  declare maidenName: string | null;
  declare religion: string | null;
  declare stateOfOrigin: string | null;
  declare nationality: string | null;
  declare nationalId: string | null;
  declare hobbies: string | null;
  declare spouseName: string | null;
  declare spouseOccupation: string | null;
  declare numberOfChildren: number | null;
  declare weddingDate: string | null;
  declare startDate: string | null;
  declare probationEndDate: string | null;
  declare probationStatus: string | null;
  declare emergencyContactName: string | null;
  declare emergencyContactPhone: string | null;
  declare emergencyContactRelation: string | null;
  declare emergencyContactAddress: string | null;
  declare bankName: string | null;
  declare bankBranch: string | null;
  declare bankAccountNumber: string | null;
  declare bankAccountName: string | null;
  declare taxId: string | null;
  declare pensionId: string | null;
  declare pfaName: string | null;
  declare rsaPin: string | null;
  declare hmo: string | null;
  declare notes: string | null;
  declare twoFactorSecret: string | null;
  declare twoFactorPendingSecret: string | null;
  declare twoFactorEnabled: boolean;
  declare twoFactorBackupCodes: string | null;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    email: { type: DataTypes.TEXT, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.TEXT, allowNull: false, field: "password_hash" },
    role: { type: DataTypes.TEXT, allowNull: false, defaultValue: "employee" },
    customRoleId: { type: DataTypes.INTEGER, field: "custom_role_id" },
    managerId: { type: DataTypes.INTEGER, field: "manager_id" },
    siteId: { type: DataTypes.INTEGER, field: "site_id" },
    department: { type: DataTypes.TEXT },
    jobTitle: { type: DataTypes.TEXT, field: "job_title" },
    phone: { type: DataTypes.TEXT },
    staffId: { type: DataTypes.TEXT, field: "staff_id" },
    profilePhoto: { type: DataTypes.TEXT, field: "profile_photo" },
    isLocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_locked" },
    failedLoginAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "failed_login_attempts" },
    lockedAt: { type: DataTypes.DATE, field: "locked_at" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "created_at" },
    surname: { type: DataTypes.TEXT },
    firstName: { type: DataTypes.TEXT, field: "first_name" },
    middleName: { type: DataTypes.TEXT, field: "middle_name" },
    address: { type: DataTypes.TEXT },
    permanentAddress: { type: DataTypes.TEXT, field: "permanent_address" },
    permanentCity: { type: DataTypes.TEXT, field: "permanent_city" },
    permanentState: { type: DataTypes.TEXT, field: "permanent_state" },
    permanentCountry: { type: DataTypes.TEXT, field: "permanent_country" },
    permanentPostalCode: { type: DataTypes.TEXT, field: "permanent_postal_code" },
    temporaryAddress: { type: DataTypes.TEXT, field: "temporary_address" },
    temporaryCity: { type: DataTypes.TEXT, field: "temporary_city" },
    temporaryState: { type: DataTypes.TEXT, field: "temporary_state" },
    temporaryCountry: { type: DataTypes.TEXT, field: "temporary_country" },
    temporaryPostalCode: { type: DataTypes.TEXT, field: "temporary_postal_code" },
    city: { type: DataTypes.TEXT },
    stateProvince: { type: DataTypes.TEXT, field: "state_province" },
    country: { type: DataTypes.TEXT },
    postalCode: { type: DataTypes.TEXT, field: "postal_code" },
    dateOfBirth: { type: DataTypes.DATEONLY, field: "date_of_birth" },
    gender: { type: DataTypes.TEXT },
    maritalStatus: { type: DataTypes.TEXT, field: "marital_status" },
    maidenName: { type: DataTypes.TEXT, field: "maiden_name" },
    religion: { type: DataTypes.TEXT },
    stateOfOrigin: { type: DataTypes.TEXT, field: "state_of_origin" },
    nationality: { type: DataTypes.TEXT },
    nationalId: { type: DataTypes.TEXT, field: "national_id" },
    hobbies: { type: DataTypes.TEXT },
    spouseName: { type: DataTypes.TEXT, field: "spouse_name" },
    spouseOccupation: { type: DataTypes.TEXT, field: "spouse_occupation" },
    numberOfChildren: { type: DataTypes.INTEGER, field: "number_of_children" },
    weddingDate: { type: DataTypes.DATEONLY, field: "wedding_date" },
    startDate: { type: DataTypes.DATEONLY, field: "start_date" },
    probationEndDate: { type: DataTypes.DATEONLY, field: "probation_end_date" },
    probationStatus: { type: DataTypes.TEXT, field: "probation_status" },
    emergencyContactName: { type: DataTypes.TEXT, field: "emergency_contact_name" },
    emergencyContactPhone: { type: DataTypes.TEXT, field: "emergency_contact_phone" },
    emergencyContactRelation: { type: DataTypes.TEXT, field: "emergency_contact_relation" },
    emergencyContactAddress: { type: DataTypes.TEXT, field: "emergency_contact_address" },
    bankName: { type: DataTypes.TEXT, field: "bank_name" },
    bankBranch: { type: DataTypes.TEXT, field: "bank_branch" },
    bankAccountNumber: { type: DataTypes.TEXT, field: "bank_account_number" },
    bankAccountName: { type: DataTypes.TEXT, field: "bank_account_name" },
    taxId: { type: DataTypes.TEXT, field: "tax_id" },
    pensionId: { type: DataTypes.TEXT, field: "pension_id" },
    pfaName: { type: DataTypes.TEXT, field: "pfa_name" },
    rsaPin: { type: DataTypes.TEXT, field: "rsa_pin" },
    hmo: { type: DataTypes.TEXT },
    notes: { type: DataTypes.TEXT },
    twoFactorSecret: { type: DataTypes.TEXT, field: "two_factor_secret" },
    twoFactorPendingSecret: { type: DataTypes.TEXT, field: "two_factor_pending_secret" },
    twoFactorEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "two_factor_enabled" },
    twoFactorBackupCodes: { type: DataTypes.TEXT, field: "two_factor_backup_codes" },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: false,
  }
);

export default User;
