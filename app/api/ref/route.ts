import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { isValidPid, dayKey } from "@/lib/leaderboard-core";
import { endpoint, ipLimit, key, requireSession, sameOrigin, body } from "@/lib/server-api";

// Counts a referred player reaching the game via a shared link.
// Client fires this once per referrer (deduped in localStorage).
export const POST = endpoint(async (req) => {
  sameOrigin(req);
  await ipLimit(req, "ref", 30, 60);
  const auth = await requireSession(req);
  const data = await body(req, 1024);
  const pid = data.pid;
  if (!isValidPid(pid)) {
    return NextResponse.json({ error: "bad pid" }, { status: 400 });
  }
  if (pid !== auth.pid && await redis.set(key(`ref:${auth.pid}`), 1, { nx: true, ex: 365 * 86400 })) {
    await redis.incr(key(`share:play:${pid}`));
    await redis.incr(key(`share:play:${dayKey()}`));
  }
  return NextResponse.json({ ok: true });
});
