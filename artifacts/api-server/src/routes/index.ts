import { Router, type IRouter } from "express";
import healthRouter from "./health";
import oauthRouter from "./oauth";
import dashboardRouter from "./dashboard/index.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(oauthRouter);
router.use(dashboardRouter);

export default router;
