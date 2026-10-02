import path from "path";
import { fileURLToPath } from "url";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
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
import { pool } from "@workspace/db";
import { rejectBlockedIp } from "./lib/ip-blocks";
import { rejectSuspendedAccount } from "./lib/account-suspension";

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

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET 환경변수가 필요합니다.");
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env["NODE_ENV"] === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// 회원 세션 미들웨어 (쿠키 이름: connect.sid)
const memberSessionMw = session({
  name: "connect.sid",
  store: new PgSession({ pool, tableName: "user_sessions" }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: cookieOpts,
});

// 어드민 세션 미들웨어 (쿠키 이름: admin.sid) — 회원 세션과 완전 분리
const adminSessionMw = session({
  name: "admin.sid",
  store: new PgSession({ pool, tableName: "user_sessions" }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: cookieOpts,
});

// req.session을 어드민 세션으로 교체하는 헬퍼
function switchToAdminSession(req: Request, res: Response, next: NextFunction): void {
  // express-session은 req.session이 이미 있으면 조기 반환하므로 제거 필요
  delete (req as unknown as Record<string, unknown>).session;
  delete (req as unknown as Record<string, unknown>).sessionID;
  adminSessionMw(req, res, next);
}

// ── 세션 라우팅 ──────────────────────────────────────────────────
// 1단계: 모든 경로에 회원 세션 적용 (기본값)
app.use(memberSessionMw);

// 2단계: 어드민 전용 경로는 어드민 세션으로 교체
app.use((req: Request, res: Response, next: NextFunction): void => {
  const p = req.path;
  const isAdminPath =
    p === "/banana777" ||
    p.startsWith("/banana777/") ||
    p.startsWith("/api/admin");
  if (isAdminPath) {
    switchToAdminSession(req, res, next);
    return;
  }
  next();
});

// 3단계: /api/auth/me — admin.sid 쿠키가 있고 유효하면 어드민 세션 사용
//  (admin-script.js의 checkSession()이 이 엔드포인트를 호출하기 때문)
app.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.path !== "/api/auth/me") {
    next();
    return;
  }
  const cookieHeader = req.headers.cookie ?? "";
  if (!cookieHeader.includes("admin.sid=")) {
    next();
    return;
  }
  // admin.sid가 있으면 어드민 세션 로드 시도
  const memberSess = req.session;
  switchToAdminSession(req, res, (err) => {
    if (err) { next(err); return; }
    if (req.session.adminId) {
      // 유효한 어드민 세션 → 그대로 사용
      next();
      return;
    }
    // admin.sid는 있지만 유효하지 않음 → 회원 세션 복원
    req.session = memberSess;
    next();
  });
});
// ─────────────────────────────────────────────────────────────────

app.use(rejectBlockedIp);
app.use(rejectSuspendedAccount);

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
