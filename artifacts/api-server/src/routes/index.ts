import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import cyclesRouter from "./cycles";
import criteriaRouter from "./criteria";
import appraisalsRouter from "./appraisals";
import goalsRouter from "./goals";
import dashboardRouter from "./dashboard";
import customRolesRouter from "./custom-roles";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(cyclesRouter);
router.use(criteriaRouter);
router.use(appraisalsRouter);
router.use(goalsRouter);
router.use(dashboardRouter);
router.use(customRolesRouter);
router.use(reportsRouter);

export default router;
