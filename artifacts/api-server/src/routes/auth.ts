import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, walletsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, nickname, phone } = req.body;

  if (!email || !password || !nickname) {
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

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.insert(usersTable).values({
    email,
    nickname,
    phone: phone ?? null,
    passwordHash,
    role: "user",
  }).returning();

  // 지갑 자동 생성
  await db.insert(walletsTable).values({ userId: user.id, balance: 0 });

  req.session.userId = user.id;
  req.session.userRole = user.role;

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
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "이메일과 비밀번호를 입력하세요." });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    // 계정이 없으면 자동 생성 (아이디/비번으로 첫 로그인 시 회원 등록)
    const passwordHash = await bcrypt.hash(password, 12);
    const nickname = email.includes("@") ? email.split("@")[0] : email;
    const [created] = await db.insert(usersTable).values({
      email,
      nickname,
      phone: null,
      passwordHash,
      role: "user",
    }).returning();
    await db.insert(walletsTable).values({ userId: created.id, balance: 0 });
    user = created;
  } else {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
      return;
    }
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;

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

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "사용자를 찾을 수 없습니다." });
    return;
  }
  // 세션 userRole이 DB 실제 role과 다를 경우 동기화
  // (서버 재시작 후 구 세션에 userRole 없는 경우, 권한 변경 후 기존 세션 등 대비)
  if (req.session.userRole !== user.role) {
    req.session.userRole = user.role;
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
