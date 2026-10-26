import { displayPlayerName } from "@/lib/player-name";
import { redis } from "@/lib/redis";
import { dayKey, yesterdayKey } from "@/lib/leaderboard-core";
import { endpoint, json, key, session } from "@/lib/server-api";

export const GET = endpoint(async (req) => {
  const auth = await session(req);
  if (!auth) return json({ streak: 0, atRisk: false });
  const p = await redis.hgetall<{ initials: string; streak: number; lastPlayed: string; best: number }>(key(`player:${auth.pid}`));
  const today = dayKey();
  const active = p?.lastPlayed === today || p?.lastPlayed === yesterdayKey(today);
  return json({ initials: displayPlayerName(p?.initials), streak: active ? Number(p?.streak ?? 0) : 0, best: Number(p?.best ?? 0), atRisk: p?.lastPlayed === yesterdayKey(today) });
});
