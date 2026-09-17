import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const DIR_LABELS: Record<string, string> = {
  up: "Roll up (north)",
  down: "Roll down (south)",
  left: "Roll left (west)",
  right: "Roll right (east)",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const state = String(body?.state ?? "").slice(0, 2000);
  if (!state) return NextResponse.json({ error: "bad state" }, { status: 400 });

  // Only offer directions the client says are actually open (no rock/pit) —
  // Jev's Choice answer is constrained to the options given, so a blocked
  // direction that's never offered can never be picked. Without this, Jev
  // has no way to know a wall is there and will walk straight into it.
  const openDirs: string[] = Array.isArray(body?.open)
    ? body.open.filter((d: unknown): d is string => typeof d === "string" && d in DIR_LABELS)
    : [];
  const criteria: Record<string, string> = { stay: "Hold still this turn" };
  for (const d of openDirs) criteria[d] = DIR_LABELS[d];

  // Rate limit: 5 req/s/IP — bounds abuse of the (paid, key-holding) proxy;
  // the game itself never asks faster than this either.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ok = await redis.set(`rl:aimove:${ip}`, 1, { nx: true, px: 200 });
  if (!ok) return NextResponse.json({ error: "slow down" }, { status: 429 });

  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return NextResponse.json({ error: "AI move not configured" }, { status: 503 });

  const resp = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      state,
      model: "jev-latest",
      questions: {
        move: {
          type: "choice",
          instructions:
            "Which direction should the cube roll next, to survive and clear parasites?",
          criteria,
        },
      },
    }),
  }).catch(() => null);
  if (!resp || !resp.ok) {
    return NextResponse.json({ error: "jev unavailable" }, { status: 502 });
  }

  const data = await resp.json().catch(() => null);
  const direction = data?.answers?.move?.choice;
  if (typeof direction !== "string" || !(direction in criteria)) {
    return NextResponse.json({ error: "bad jev response" }, { status: 502 });
  }
  return NextResponse.json({
    direction,
    confidence: data?.answers?.move?.confidence ?? null,
    probabilities: data?.answers?.move?.probabilities ?? null,
    usage: data?.usage ?? null,
  });
}
