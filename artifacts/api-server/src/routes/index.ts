import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import walletsRouter from "./wallets";
import transactionsRouter from "./transactions";
import botsRouter from "./bots";
import commissionsRouter from "./commissions";
import withdrawalsRouter from "./withdrawals";
import internalRouter from "./internal";
import statsRouter from "./stats";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(walletsRouter);
router.use(transactionsRouter);
router.use(botsRouter);
router.use(commissionsRouter);
router.use(withdrawalsRouter);
router.use(internalRouter);
router.use(statsRouter);
router.use(settingsRouter);

export default router;
