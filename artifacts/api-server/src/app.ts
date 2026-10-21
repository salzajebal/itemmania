import path from "path";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import proxyRouter from "./routes/proxy";
import adminUiRouter from "./routes/admin-ui";
import customerUiRouter from "./routes/customer-ui";
import { logger } from "./lib/logger";
import { snapshotFontsRouter } from "./lib/snapshot-fonts";
import { homepageAssetsRouter } from "./lib/homepage-assets";
import { pool } from "@workspace/db";
import { rejectBlockedIp } from "./lib/ip-blocks";
import { rejectSuspendedAccount } from "./lib/account-suspension";
import { createSessionRouter } from "./lib/session-routing";
import { supportUiRouter, injectSupportUi } from "./lib/support-ui";
import memberPasswordUiRouter from "./routes/member-password-ui";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.set("trust proxy", true);

const PgSession = ConnectPgSimple(session);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public content-hashed fonts are served before session loading.
app.use(snapshotFontsRouter);
// Public homepage artwork needs no member/admin session or database access.
app.use(homepageAssetsRouter);

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET 환경변수가 필요합니다.");
}

// Exactly one session middleware per request, with separate persistence.
// No cookie/session switching or administrator fallback on member endpoints.
app.use(createSessionRouter(
  new PgSession({ pool, tableName: "user_sessions" }),
  new PgSession({ pool, tableName: "admin_sessions" }),
  sessionSecret, process.env["NODE_ENV"] === "production",
));

app.use(rejectBlockedIp);
app.use(rejectSuspendedAccount);
app.use(supportUiRouter);
app.use(injectSupportUi);
app.use(memberPasswordUiRouter);

// 채팅 이미지 업로드 정적 서빙
app.use("/chat-images", express.static(path.join(__dirname, "..", "uploads", "chat-images")));

// /proxy/* 는 /api 밖에 위치 (프록시는 API가 아님)
app.use(proxyRouter);

// /customer 고객센터 UI
app.use(customerUiRouter);

// /banana777 어드민 UI (api prefix 없이)
app.use(adminUiRouter);

// /api/* 라우터
app.use("/api", router);

export default app;
