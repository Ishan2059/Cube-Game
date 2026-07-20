import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { dayKey } from "@/lib/leaderboard-core";

type Row = { pid: string; initials: string; score: number; rank: number };

// zrange(withScores) returns a flat [member, score, member, score, ...].
// Resolve each member's initials (pipeline) and attach 1-based ranks.
async function toRows(flat: (string | number)[], startRank: number): Promise<Row[]> {
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
    rows.forEach((r) => p.hget(`player:${r.pid}`, "initials"));
    const names = (await p.exec()) as (string | null)[];
    rows.forEach((r, i) => (r.initials = names[i] || "???"));
  }
  return rows;
}

export async function GET(req: Request) {
  const pid = new URL(req.url).searchParams.get("pid") ?? "";
  const boardKey = `lb:${dayKey()}`;

  const total = await redis.zcard(boardKey);
  const topFlat = (await redis.zrange(boardKey, 0, 49, {
    rev: true,
    withScores: true,
  })) as (string | number)[];
  const top10 = await toRows(topFlat, 1);

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
      neighbors = await toRows(nFlat, start + 1);
    }
  }

  return NextResponse.json({ top10, myRank, total, neighbors });
}
