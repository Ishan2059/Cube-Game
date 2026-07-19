import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { isValidPid, dayKey } from "@/lib/leaderboard-core";

// Counts a referred player reaching the game via a shared link.
// Client fires this once per referrer (deduped in localStorage).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pid = body?.pid;
  if (!isValidPid(pid)) {
    return NextResponse.json({ error: "bad pid" }, { status: 400 });
  }
  await redis.incr(`share:play:${pid}`);
  await redis.incr(`share:play:${dayKey()}`);
  return NextResponse.json({ ok: true });
}
