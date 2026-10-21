import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletRouter from "./wallet";
import ordersRouter from "./orders";
import chatRouter from "./chat";
import productsRouter from "./products";
import adminRouter from "./admin";
import gamesRouter from "./games";
import eventsRouter from "./events";
import notificationsRouter from "./notifications";
import ipBlocksRouter from "./ip-blocks";
import supportRouter from "./support";

const router: IRouter = Router();

router.use(healthRouter);
router.use(supportRouter);
router.use(authRouter);
router.use(walletRouter);
router.use(ordersRouter);
router.use(notificationsRouter);
router.use(chatRouter);
router.use(productsRouter);
router.use(ipBlocksRouter);
router.use(adminRouter);
router.use(gamesRouter);
router.use(eventsRouter);

export default router;
