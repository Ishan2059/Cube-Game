import { redis } from "@/lib/redis";
import { ALL_TIME_BOARD_KEY, ensureAllTimeBoard } from "@/lib/leaderboard-store";

import { displayPlayerName } from "@/lib/player-name";
import { endpoint, json, key, session } from "@/lib/server-api";

type Row = { pid: string; initials: string; score: number; rank: number };

// zrange(withScores) returns a flat [member, score, member, score, ...].
// Resolve each member's initials (pipeline) and attach 1-based ranks.
async function toRows(flat: (string | number)[], startRank: number, legacy: boolean): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    rows.push({
      pid: String(flat[i]),
      initials: "???",
      score: Number(flat[i + 1]),
      rank: startRank + i / 2,
    });
  }
  if (rows.length) {
    const p = redis.pipeline();
    rows.forEach((r) => p.hget(legacy ? `player:${r.pid}` : key(`player:${r.pid}`), "initials"));
    const names = (await p.exec()) as (string | null)[];
    rows.forEach((r, i) => (r.initials = displayPlayerName(names[i])));
  }
  return rows;
}

export const GET = endpoint(async (req) => {
  const requested = new URL(req.url).searchParams.get("mode");
  const mode = requested === "casual" || requested === "legacy" ? requested : "normal";
  const legacy = mode === "legacy";
  // Preview/local credentials may point at production accidentally: never read
  // or backfill the unnamespaced historical database outside production.
  const production = process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");
  if (legacy && !production) return json({ top10: [], myRank: null, total: 0, neighbors: [], me: null, mode });
  if (legacy) await ensureAllTimeBoard(redis);
  const pid = legacy ? "" : (await session(req))?.pid ?? "";
  const boardKey = legacy ? ALL_TIME_BOARD_KEY : key(`board:${mode}`);

  const total = await redis.zcard(boardKey);
  const topFlat = (await redis.zrange(boardKey, 0, 9, {
    rev: true,
    withScores: true,
  })) as (string | number)[];
  const top10 = await toRows(topFlat, 1, legacy);

  let myRank: number | null = null;
  let neighbors: Row[] = [];
  if (pid) {
    const r = await redis.zrevrank(boardKey, pid);
    if (r !== null) {
      myRank = r + 1;
      const start = Math.max(0, r - 2);
      const nFlat = (await redis.zrange(boardKey, start, r + 2, {
        rev: true,
        withScores: true,
      })) as (string | number)[];
      neighbors = await toRows(nFlat, start + 1, legacy);
    }
  }

  const me = neighbors.find(row => row.pid === pid) ?? null;
  return json({ top10, myRank, total, neighbors, me, mode });
});
