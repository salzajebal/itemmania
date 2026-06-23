import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
    const ADMIN_PASSWORD = "tkfwkwpqkf!@!";

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

seedAdmin().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
