import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { sanitizeInitials } from "@/lib/leaderboard-core";

// Updates only the player's display name. The leaderboard/rank/challenge
// pages all resolve initials live from player:{pid} at read time (never a
// frozen copy stored alongside a score), so this alone makes a rename show
// up everywhere immediately.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const pid = String(body?.pid ?? "");
  if (!/^[a-z0-9-]{8,64}$/i.test(pid)) {
    return NextResponse.json({ error: "bad pid" }, { status: 400 });
  }
  const initials = sanitizeInitials(body?.initials);
  await redis.hset(`player:${pid}`, { initials });
  return NextResponse.json({ initials });
}
