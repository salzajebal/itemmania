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
import { pool } from "@workspace/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Replit 역방향 프록시(HTTPS 종료) 신뢰: secure 쿠키가 프록시 뒤에서도 정상 발급되도록 필수
app.set("trust proxy", 1);

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

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET 환경변수가 필요합니다.");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    },
  }),
);

// 채팅 이미지 업로드 정적 서빙
app.use("/chat-images", express.static(path.join(__dirname, "..", "uploads", "chat-images")));

// /proxy/* 는 /api 밖에 위치 (프록시는 API가 아님)
app.use(proxyRouter);

// /customer 고객센터 UI
app.use(customerUiRouter);

// /admin 어드민 UI (api prefix 없이)
app.use(adminUiRouter);

// /api/* 라우터
app.use("/api", router);

export default app;
