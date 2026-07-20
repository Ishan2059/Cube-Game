import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { dayKey, yesterdayKey } from "@/lib/leaderboard-core";

// Home streak-at-risk hook. Returns streak + whether it's about to break
// (played yesterday but not yet today).
export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get("pid") ?? "";
  if (!pid) return NextResponse.json({ streak: 0, atRisk: false });

  const p = (await redis.hgetall(`player:${pid}`)) as
    | { initials?: string; streak?: number; lastPlayed?: string; best?: number }
    | null;

  const today = dayKey();
  const streak = Number(p?.streak ?? 0);
  const atRisk = !!p?.lastPlayed && p.lastPlayed === yesterdayKey(today);

  return NextResponse.json({
    initials: p?.initials ?? "",
    streak,
    best: Number(p?.best ?? 0),
    atRisk,
  });
}
