import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  dayKey,
  computeStreak,
  sanitizeInitials,
  validateScore,
} from "@/lib/leaderboard-core";

type PlayerHash = { initials: string; streak: number; lastPlayed: string; best: number };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pid = String(body?.pid ?? "");
  if (!/^[a-z0-9-]{8,64}$/i.test(pid)) {
    return NextResponse.json({ error: "bad pid" }, { status: 400 });
  }

  const score = validateScore(body?.score);
  if (score === null) {
    return NextResponse.json({ error: "bad score" }, { status: 400 });
  }
  const initials = sanitizeInitials(body?.initials);

  // Rate limit: 1 submit / 2s / player.
  const ok = await redis.set(`rl:${pid}`, 1, { nx: true, ex: 2 });
  if (!ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const today = dayKey();
  const boardKey = `lb:${today}`;
  const playerKey = `player:${pid}`;

  // GT = only overwrite if greater, so the board holds each player's best today.
  await redis.zadd(boardKey, { gt: true }, { score, member: pid });
  await redis.expire(boardKey, 60 * 60 * 48); // 48h

  const prev = (await redis.hgetall(playerKey)) as PlayerHash | null;
  const streak = computeStreak(prev?.lastPlayed, Number(prev?.streak ?? 0), today);
  const best = Math.max(Number(prev?.best ?? 0), score);
  await redis.hset(playerKey, { initials, streak, lastPlayed: today, best });

  const rank = await redis.zrevrank(boardKey, pid); // 0-based, null if absent
  const total = await redis.zcard(boardKey);

  return NextResponse.json({
    rank: rank === null ? null : rank + 1, // 1-based for display
    total,
    streak,
    best,
  });
}
