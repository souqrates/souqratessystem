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
import gamesRouter from "./games";
import superadminRouter from "./superadmin";
import superadminGamesRouter from "./superadmin-games";
import agreementsRouter from "./agreements";
import booksRouter from "./books";
import contestsRouter from "./contests";
import objectsRouter from "./objects";
// Cryptomus payments removed (content restrictions). Card top-ups now route
// users to @wallet; the existing TON/USDT on-chain deposit watcher handles
// the actual credit. `./payments` is kept unmounted for reference only.
// import paymentsRouter from "./payments";
import integrationsRouter from "./integrations";
import runtimeConfigRouter from "./runtime-config";
import subagentsRouter from "./subagents";
import superadminSubagentsRouter from "./superadmin-subagents";
import sweepRouter from "./sweep";

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
router.use(gamesRouter);
router.use(superadminRouter);
router.use(superadminGamesRouter);
router.use(agreementsRouter);
router.use(booksRouter);
router.use(contestsRouter);
router.use(objectsRouter);
// router.use(paymentsRouter); // disabled — see import comment above
router.use(integrationsRouter);
router.use(runtimeConfigRouter);
router.use(subagentsRouter);
router.use(superadminSubagentsRouter);
router.use(sweepRouter);

export default router;
