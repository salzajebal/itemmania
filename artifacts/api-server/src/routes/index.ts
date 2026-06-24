import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import walletRouter from "./wallet";
import ordersRouter from "./orders";
import chatRouter from "./chat";
import productsRouter from "./products";
import adminRouter from "./admin";
import gamesRouter from "./games";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(walletRouter);
router.use(ordersRouter);
router.use(chatRouter);
router.use(productsRouter);
router.use(adminRouter);
router.use(gamesRouter);

export default router;
