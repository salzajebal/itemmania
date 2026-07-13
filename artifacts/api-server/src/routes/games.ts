import { Router } from "express";
import { db, gamesTable, gameServersTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const router = Router();

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function getChosung(char: string): string {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return char;
  return CHOSUNG[Math.floor((code - 0xAC00) / (21 * 28))];
}

function isChosungOnly(str: string): boolean {
  return str.length > 0 && [...str].every(c => c >= 'ㄱ' && c <= 'ㅎ');
}

function matchesQuery(name: string, query: string): boolean {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n.includes(q)) return true;
  if (isChosungOnly(query)) {
    const nameChosung = [...name].map(getChosung).join('');
    return nameChosung.includes(query);
  }
  return false;
}

// GET /api/games/search?q=검색어 (초성 검색 지원)
router.get("/games/search", async (req, res): Promise<void> => {
  const q = String(req.query["q"] ?? "").trim();

  if (!q) { res.json([]); return; }

  const allGames = await db.select().from(gamesTable).orderBy(asc(gamesTable.sortOrder));
  const matched = allGames.filter(g => matchesQuery(g.name, q)).slice(0, 20);

  const result = await Promise.all(
    matched.map(async (game) => {
      const servers = await db
        .select({ id: gameServersTable.id, name: gameServersTable.name })
        .from(gameServersTable)
        .where(eq(gameServersTable.gameId, game.id))
        .orderBy(asc(gameServersTable.sortOrder));
      return { id: game.id, name: game.name, code: game.code, servers };
    }),
  );

  res.json(result);
});

// GET /api/games/bycode/:code  → { id, name, code }
router.get("/games/bycode/:code", async (req, res): Promise<void> => {
  const code = req.params["code"] ?? "";
  if (!code) { res.status(400).json({ error: "code 필요" }); return; }

  const [game] = await db.select().from(gamesTable).where(eq(gamesTable.code, code)).limit(1);
  if (!game) { res.status(404).json({ error: "게임 없음" }); return; }

  res.json({ id: game.id, name: game.name, code: game.code });
});

// GET /api/games/:id/servers
router.get("/games/:id/servers", async (req, res): Promise<void> => {
  const gameId = parseInt(req.params["id"] ?? "0", 10);
  if (!gameId) { res.status(400).json({ error: "잘못된 game id" }); return; }

  const servers = await db
    .select({ id: gameServersTable.id, name: gameServersTable.name })
    .from(gameServersTable)
    .where(eq(gameServersTable.gameId, gameId))
    .orderBy(asc(gameServersTable.sortOrder));

  res.json(servers);
});

export default router;
