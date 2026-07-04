import { Router, type IRouter } from "express";
import authRouter from "./auth.js";
import statsRouter from "./stats.js";
import commandsRouter from "./commands.js";
import embedsRouter from "./embeds.js";
import modulesRouter from "./modules.js";
import botControlRouter from "./botControl.js";
import filesRouter from "./files.js";
import databaseRouter from "./database.js";
import auditRouter from "./audit.js";
import searchRouter from "./search.js";
import assistantRouter from "./assistant.js";

const router: IRouter = Router();

router.use("/dashboard/auth", authRouter);
router.use("/dashboard", statsRouter);
router.use("/dashboard", commandsRouter);
router.use("/dashboard", embedsRouter);
router.use("/dashboard", modulesRouter);
router.use("/dashboard", botControlRouter);
router.use("/dashboard", filesRouter);
router.use("/dashboard", databaseRouter);
router.use("/dashboard", auditRouter);
router.use("/dashboard", searchRouter);
router.use("/dashboard", assistantRouter);

export default router;
