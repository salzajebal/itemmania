import { Router } from "express";
import { db, gamesTable, gameServersTable } from "@workspace/db";
import { ilike, or, asc, eq } from "drizzle-orm";

const router = Router();

// GET /api/games/search?q=검색어  → [{id, name, code, servers:[{id,name}]}]
router.get("/games/search", async (req, res): Promise<void> => {
  const q = String(req.query["q"] ?? "").trim();

  const games = q
    ? await db
        .select()
        .from(gamesTable)
        .where(ilike(gamesTable.name, `%${q}%`))
        .orderBy(asc(gamesTable.sortOrder))
        .limit(20)
    : await db
        .select()
        .from(gamesTable)
        .orderBy(asc(gamesTable.sortOrder))
        .limit(20);

  const result = await Promise.all(
    games.map(async (game) => {
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
