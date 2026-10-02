import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { notifyAdmin } from "./notifications";
import { clientIp } from "../lib/ip-blocks";
import { createMemberAccount, getRegistrationPolicy, RegistrationBlockedError } from "../lib/registration-policy";

function memberIp(req: Parameters<typeof clientIp>[0]): string | null {
  const ip = clientIp(req);
  return ip === "127.0.0.1" || ip === "::1" ? null : ip;
}

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, nickname, phone } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || typeof nickname !== "string" || !email || !password || !nickname) {
    res.status(400).json({ error: "이메일, 비밀번호, 닉네임은 필수입니다." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "비밀번호는 6자 이상이어야 합니다." });
    return;
  }
  if (nickname.length < 2) {
    res.status(400).json({ error: "닉네임은 2자 이상이어야 합니다." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
    return;
  }

  let user: typeof usersTable.$inferSelect;
  try {
    if ((await getRegistrationPolicy()).blocked) throw new RegistrationBlockedError();
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createMemberAccount({
      email,
      nickname,
      phone: phone ?? null,
      passwordHash,
      role: "user",
      grade: "bronze",
      creditScore: 220,
      signupIp: memberIp(req),
    });
    if (!result.created) {
      res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
      return;
    }
    user = result.user;
  } catch (error) {
    if (error instanceof RegistrationBlockedError) {
      res.status(403).json({ code: "REGISTRATION_DISABLED", error: error.message });
    } else {
      req.log.error({ err: error }, "회원가입 설정 확인 또는 계정 생성 실패");
      res.status(503).json({ error: "현재 회원가입을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." });
    }
    return;
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

  notifyAdmin("신규 회원가입", {
    body: `${user.nickname} (${user.email})`,
    link: "/banana777",
  }).catch(() => {});

  res.status(201).json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(400).json({ error: "이메일과 비밀번호를 입력하세요." });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  let autoCreated = false;

  if (!user) {
    // 계정이 없으면 자동 생성 (아이디/비번으로 첫 로그인 시 회원 등록)
    try {
      if ((await getRegistrationPolicy()).blocked) throw new RegistrationBlockedError();
      const passwordHash = await bcrypt.hash(password, 12);
      const nickname = email.includes("@") ? email.split("@")[0] : email;
      const result = await createMemberAccount({
        email,
        nickname,
        phone: null,
        passwordHash,
        role: "user",
        grade: "bronze",
        creditScore: 220,
        signupIp: memberIp(req),
        lastLoginIp: memberIp(req),
      });
      user = result.user;
      autoCreated = result.created;
    } catch (error) {
      if (error instanceof RegistrationBlockedError) {
        res.status(403).json({ code: "REGISTRATION_DISABLED", error: error.message });
      } else {
        req.log.error({ err: error }, "자동 회원가입 설정 확인 또는 계정 생성 실패");
        res.status(503).json({ error: "현재 신규 계정 생성을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요." });
      }
      return;
    }
  }
  if (!autoCreated) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
      return;
    }
    if (user.suspendedAt) {
      res.status(403).json({ error: "차단된 계정입니다. 관리자에게 문의해 주세요." });
      return;
    }
    const ip = memberIp(req);
    if (ip) await db.update(usersTable).set({ lastLoginIp: ip }).where(eq(usersTable.id, user.id));
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;
  if (req.body.autoLogin === false) {
    // 모바일에서 자동 로그인을 끄면 브라우저를 닫을 때 사라지는 세션 쿠키를 사용한다.
    req.session.cookie.expires = null;
    req.session.cookie.originalMaxAge = null;
  }

  notifyAdmin("회원 로그인", {
    body: `${user.nickname} (${user.email})`,
    link: "/banana777",
  }).catch(() => {});

  res.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.get("/auth/check-id", async (req, res): Promise<void> => {
  const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
  if (!id || id.length < 4) {
    res.status(400).json({ available: false, error: "아이디는 4자 이상이어야 합니다." });
    return;
  }
  if (!/^[a-zA-Z0-9]{4,16}$/.test(id)) {
    res.status(400).json({ available: false, error: "영문자와 숫자만 사용 가능합니다." });
    return;
  }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, id));
  res.json({ available: !existing });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.post("/admin/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "이메일과 비밀번호를 입력하세요." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "관리자 권한이 없습니다." });
    return;
  }
  // 어드민 전용 세션(admin.sid)에만 기록 — 회원 세션(connect.sid)과 완전 분리됨
  req.session.adminId = user.id;
  req.session.adminRole = user.role;
  await new Promise<void>((resolve) => req.session.save(() => resolve()));
  res.json({ id: user.id, email: user.email, nickname: user.nickname, role: user.role });
});

router.post("/admin/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  // userId(회원 세션) 우선, 없으면 adminId(어드민 전용 세션) 사용
  const lookupId = req.session.userId ?? req.session.adminId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, lookupId!));
  if (!user) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }
  // 세션 role 동기화 (admin이면 adminId/adminRole도 함께 설정)
  const needsSync = req.session.userRole !== user.role
    || (user.role === "admin" && !req.session.adminId);
  if (needsSync) {
    req.session.userRole = user.role;
    if (user.role === "admin") {
      req.session.adminId = user.id;
      req.session.adminRole = "admin";
    }
    await new Promise<void>((resolve) => req.session.save(() => resolve()));
  }
  res.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    phone: user.phone,
    role: user.role,
    grade: user.grade ?? null,
    createdAt: user.createdAt,
  });
});

export default router;
