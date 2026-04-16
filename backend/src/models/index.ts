import sequelize from "../db/sequelize.js";
import User from "./User.js";
import CustomRole from "./CustomRole.js";
import StaffDocument from "./StaffDocument.js";
import StaffBeneficiary from "./StaffBeneficiary.js";
import StaffWorkExperience from "./StaffWorkExperience.js";
import StaffEducation from "./StaffEducation.js";
import StaffReference from "./StaffReference.js";
import DisciplinaryRecord from "./DisciplinaryRecord.js";
import DisciplinaryAttachment from "./DisciplinaryAttachment.js";
import StaffReminder from "./StaffReminder.js";
import Cycle from "./Cycle.js";
import Criterion from "./Criterion.js";
import CriteriaGroup from "./CriteriaGroup.js";
import CriteriaGroupItem from "./CriteriaGroupItem.js";
import Appraisal from "./Appraisal.js";
import AppraisalScore from "./AppraisalScore.js";
import AppraisalReviewer from "./AppraisalReviewer.js";
import AppraisalReviewerScore from "./AppraisalReviewerScore.js";
import Goal from "./Goal.js";
import Department from "./Department.js";
import Site from "./Site.js";
import LeaveType from "./LeaveType.js";
import LeaveRequest from "./LeaveRequest.js";
import LeaveApprover from "./LeaveApprover.js";
import LeavePolicy from "./LeavePolicy.js";
import LeaveAllocation from "./LeaveAllocation.js";
import AttendanceLog from "./AttendanceLog.js";
import Timesheet from "./Timesheet.js";
import TimesheetApprover from "./TimesheetApprover.js";
import TimesheetEntry from "./TimesheetEntry.js";
import AttendanceLocationPing from "./AttendanceLocationPing.js";
import WorkflowTemplate from "./WorkflowTemplate.js";
import TemplateTask from "./TemplateTask.js";
import OnboardingWorkflow from "./OnboardingWorkflow.js";
import WorkflowTask from "./WorkflowTask.js";
import OnboardingDocument from "./OnboardingDocument.js";
import HrQuery from "./HrQuery.js";
import HrQueryMessage from "./HrQueryMessage.js";
import SecuritySettings from "./SecuritySettings.js";
import AppSettings from "./AppSettings.js";
import TransferRequest from "./TransferRequest.js";
import ConfirmationReview from "./ConfirmationReview.js";
import JobRequisition from "./JobRequisition.js";
import Candidate from "./Candidate.js";
import NotificationSettings from "./NotificationSettings.js";

export {
  sequelize,
  User,
  CustomRole,
  StaffDocument,
  StaffBeneficiary,
  StaffWorkExperience,
  StaffEducation,
  StaffReference,
  DisciplinaryRecord,
  DisciplinaryAttachment,
  StaffReminder,
  Cycle,
  Criterion,
  CriteriaGroup,
  CriteriaGroupItem,
  Appraisal,
  AppraisalScore,
  AppraisalReviewer,
  AppraisalReviewerScore,
  Goal,
  Department,
  Site,
  LeaveType,
  LeaveRequest,
  LeaveApprover,
  LeavePolicy,
  LeaveAllocation,
  AttendanceLog,
  Timesheet,
  TimesheetApprover,
  TimesheetEntry,
  AttendanceLocationPing,
  WorkflowTemplate,
  TemplateTask,
  OnboardingWorkflow,
  WorkflowTask,
  OnboardingDocument,
  HrQuery,
  HrQueryMessage,
  SecuritySettings,
  AppSettings,
  TransferRequest,
  ConfirmationReview,
  JobRequisition,
  Candidate,
  NotificationSettings,
};
