import { Router } from "express";
import { GetCompanyInfoAction } from "../actions/careers/GetCompanyInfoAction.js";
import { ListJobsAction } from "../actions/careers/ListJobsAction.js";
import { GetJobAction } from "../actions/careers/GetJobAction.js";
import { GetUploadUrlAction } from "../actions/careers/GetUploadUrlAction.js";
import { ApplyAction } from "../actions/careers/ApplyAction.js";
import { GetApplicationAction } from "../actions/careers/GetApplicationAction.js";

const router = Router();

router.get("/careers/company", GetCompanyInfoAction.handle);
router.get("/careers/jobs", ListJobsAction.handle);
router.get("/careers/jobs/:id", GetJobAction.handle);
router.post("/careers/upload-url", GetUploadUrlAction.handle);
router.post("/careers/apply/:jobId", ApplyAction.handle);
router.get("/careers/application/:token", GetApplicationAction.handle);

export default router;
