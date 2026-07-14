import app from "./app";
import { logger } from "./lib/logger";
import { startAutoScheduler } from "./routes/admin";
import { db, usersTable, walletsTable, gamesTable, gameServersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdmin(): Promise<void> {
  try {
    const ADMIN_EMAIL = "admin";
    const ADMIN_PASSWORD = "admin1234";

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL));

    if (existing) {
      // 항상 비밀번호·권한을 최신으로 동기화
      await db
        .update(usersTable)
        .set({ passwordHash, role: "admin", nickname: "관리자" })
        .where(eq(usersTable.email, ADMIN_EMAIL));
      logger.info("admin 비밀번호/권한 동기화 완료");
      return;
    }

    const [inserted] = await db.insert(usersTable).values({
      email: ADMIN_EMAIL,
      passwordHash,
      nickname: "관리자",
      role: "admin",
    }).returning({ id: usersTable.id });

    await db.insert(walletsTable).values({ userId: inserted.id, balance: 0 });
    logger.info("admin 계정 신규 생성 완료");
  } catch (err) {
    logger.error({ err }, "admin 계정 생성/동기화 실패");
  }
}

const GAME_SEED_DATA: Array<{ name: string; code: string | null; servers: string[] }> = [
  { name: "리니지클래식", code: "5913", servers: ["크로니클","이너스","카인","데포로쥬","쉐이엔","제우스","디온","아덴","글루디오","기란","기란2","기란3","오렌","오렌2","아덴2","엘모어"] },
  { name: "메이플스토리", code: "8458", servers: ["스카니아","베라","레드","이노시스","크로아","유니온","이든","헤네시스","엘리시움","아케인","나루","루미","오로라","제니스","마리아","홀리"] },
  { name: "메이플스토리월드", code: "5233", servers: ["메이플플래닛","아르테일","로나","메이플스타","바람의나라키우기","기타"] },
  { name: "메이플랜드", code: "5990", servers: ["일반","버닝월드","기타"] },
  { name: "마비노기", code: null, servers: ["류트","만돌린","하프","첼로","템페스트","라사","이리아"] },
  { name: "로스트아크", code: null, servers: ["아브렐슈드","아제나","아만","아이기르","안톤","알테이아","실린","카제로스"] },
  { name: "던전앤파이터", code: null, servers: ["안톤","카인","디레지에","시로코","바칼","베가"] },
  { name: "오딘", code: null, servers: ["브라기","프레이야","토르","헤임달","오딘"] },
  { name: "리니지M", code: null, servers: ["제우스","데포로쥬","크로니클","아덴","이너스","쉐이엔","카인","글루디오","디온","기란","기란2","기란3","오렌","오렌2","아덴2"] },
  { name: "거상", code: null, servers: ["대만","한국","일본"] },
  { name: "아이온2", code: null, servers: ["룩세리스","암브로시아","에테르나"] },
  { name: "바람의나라", code: null, servers: ["달빛","별빛","하늘빛","은빛","금빛","초록빛"] },
  { name: "리니지2M", code: null, servers: ["아덴","글루디오","엘모어","이너스"] },
  { name: "검은사막", code: null, servers: ["세겔나","발레노스","세레니아","칼페온","카마실비아","메디아"] },
  { name: "리니지2", code: null, servers: ["아덴","카인","기란","하딘","크로니클","비엔치아","엘모어","이너스"] },
  { name: "미르의전설2", code: null, servers: ["비룡","황룡","청룡","신룡"] },
  { name: "리니지W", code: null, servers: ["아인하사드"] },
  { name: "디아블로4", code: null, servers: [] },
  { name: "블레이드앤소울2", code: null, servers: ["서버1","서버2","서버3"] },
  { name: "뮤온라인", code: null, servers: ["이지우","대천사","마스터","헤로익","스피릿"] },
  { name: "이카루스", code: null, servers: ["단일서버"] },
  { name: "아키에이지", code: null, servers: ["가이아","레아","에라","단테","이피온"] },
  { name: "라그나로크 온라인", code: null, servers: ["프로닐","이로닐","재로닐"] },
  { name: "테라", code: null, servers: ["에리야","아테네","시루스","아제라"] },
];

async function seedGames(): Promise<void> {
  try {
    // 기존 게임명 목록을 가져와 누락된 게임만 삽입 (incremental upsert)
    const existing = await db.select({ name: gamesTable.name }).from(gamesTable);
    const existingNames = new Set(existing.map((r) => r.name));

    const missing = GAME_SEED_DATA.filter((g) => !existingNames.has(g.name));
    if (missing.length === 0) {
      logger.info({ total: existing.length }, "게임 시드 데이터 최신 상태 — 건너뜀");
      return;
    }

    // sort_order 최댓값 조회
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(sort_order), 0)::int` })
      .from(gamesTable);
    let sortOrder = maxOrder + 1;

    for (const g of missing) {
      const values: { name: string; sortOrder: number; code?: string } = { name: g.name, sortOrder };
      if (g.code) values.code = g.code;
      const [inserted] = await db.insert(gamesTable).values(values).returning({ id: gamesTable.id });
      sortOrder++;

      if (g.servers.length > 0) {
        await db.insert(gameServersTable).values(
          g.servers.map((s, i) => ({ gameId: inserted.id, name: s, sortOrder: i }))
        );
      }
    }
    logger.info({ inserted: missing.length }, "게임 시드 데이터 삽입 완료");
  } catch (err) {
    logger.error({ err }, "게임 시드 데이터 삽입 실패");
  }
}

seedAdmin()
  .then(() => seedGames())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      startAutoScheduler();
    });
  });
