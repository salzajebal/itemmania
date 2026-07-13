import { Router } from "express";
import { db, gamesTable, gameServersTable } from "@workspace/db";
import { asc } from "drizzle-orm";

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

// 인메모리 캐시: 게임+서버 전체 목록 (5분 TTL)
interface GameWithServers {
  id: number;
  name: string;
  code: string | null;
  servers: { id: number; name: string }[];
}

let gamesCache: GameWithServers[] | null = null;
let gamesCacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

export function invalidateGamesCache(): void {
  gamesCache = null;
  gamesCacheAt = 0;
}

export async function getAllGamesWithServers(): Promise<GameWithServers[]> {
  const now = Date.now();
  if (gamesCache && now - gamesCacheAt < CACHE_TTL) return gamesCache;

  // 단일 쿼리로 게임+서버 전체 조회 (N+1 제거)
  const games = await db.select().from(gamesTable).orderBy(asc(gamesTable.sortOrder));
  const servers = await db.select().from(gameServersTable).orderBy(asc(gameServersTable.sortOrder));

  const serversByGame = new Map<number, { id: number; name: string }[]>();
  for (const s of servers) {
    const arr = serversByGame.get(s.gameId) ?? [];
    arr.push({ id: s.id, name: s.name });
    serversByGame.set(s.gameId, arr);
  }

  gamesCache = games.map(g => ({
    id: g.id,
    name: g.name,
    code: g.code,
    servers: serversByGame.get(g.id) ?? [],
  }));
  gamesCacheAt = now;
  return gamesCache;
}

// GET /api/games/search?q=검색어 (초성 검색 지원)
router.get("/games/search", async (req, res): Promise<void> => {
  const q = String(req.query["q"] ?? "").trim();

  if (!q) { res.json([]); return; }

  const allGames = await getAllGamesWithServers();
  const result = allGames.filter(g => matchesQuery(g.name, q)).slice(0, 20);

  res.set("Cache-Control", "public, max-age=60");
  res.json(result);
});

// GET /api/games/bycode/:code  → { id, name, code }
router.get("/games/bycode/:code", async (req, res): Promise<void> => {
  const code = req.params["code"] ?? "";
  if (!code) { res.status(400).json({ error: "code 필요" }); return; }

  const allGames = await getAllGamesWithServers();
  const game = allGames.find(g => g.code === code);
  if (!game) { res.status(404).json({ error: "게임 없음" }); return; }

  res.set("Cache-Control", "public, max-age=300");
  res.json({ id: game.id, name: game.name, code: game.code });
});

// GET /api/games/:id/servers
router.get("/games/:id/servers", async (req, res): Promise<void> => {
  const gameId = parseInt(req.params["id"] ?? "0", 10);
  if (!gameId) { res.status(400).json({ error: "잘못된 game id" }); return; }

  const allGames = await getAllGamesWithServers();
  const game = allGames.find(g => g.id === gameId);

  res.set("Cache-Control", "public, max-age=300");
  res.json(game?.servers ?? []);
});

export default router;
