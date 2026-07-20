import type { Metadata } from "next";
import Link from "next/link";
import { redis } from "@/lib/redis";
import { isValidPid, dayKey } from "@/lib/leaderboard-core";

type PlayerHash = { initials?: string; best?: number | string; streak?: number | string };

async function loadPlayer(pid: string) {
  if (!isValidPid(pid)) return null;
  const p = (await redis.hgetall(`player:${pid}`)) as PlayerHash | null;
  if (!p || p.best == null) return null;
  return {
    initials: String(p.initials || "player"),
    best: Number(p.best) || 0,
    streak: Number(p.streak) || 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pid: string }>;
}): Promise<Metadata> {
  const { pid } = await params;
  const p = await loadPlayer(pid);
  const title = p ? `${p.initials} scored ${p.best} in Crush` : "Crush";
  const description = p
    ? `${p.initials} is on a 🔥${p.streak} streak. Think you can beat ${p.best}?`
    : "Crush the parasite horde. Climb the daily board.";
  // og:image is wired automatically by opengraph-image.tsx in this folder.
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const { pid } = await params;
  const p = await loadPlayer(pid);

  // Funnel counters (best-effort): landings per player + per day.
  if (p) {
    void redis.incr(`share:land:${pid}`);
    void redis.incr(`share:land:${dayKey()}`);
  }

  const playHref = isValidPid(pid) ? `/?ref=${pid}` : "/";

  return (
    <main className="challenge">
      <div className="challenge-card">
        <p className="challenge-kicker">CRUSH · DAILY CHALLENGE</p>
        {p ? (
          <>
            <h1 className="challenge-name">{p.initials}</h1>
            <p className="challenge-score">{p.best.toLocaleString()}</p>
            {p.streak > 0 && <p className="challenge-streak">🔥 {p.streak} DAY STREAK</p>}
          </>
        ) : (
          <h1 className="challenge-name">Crush the horde</h1>
        )}
        <Link href={playHref} className="challenge-cta">
          {p ? `BEAT ${p.best.toLocaleString()} →` : "PLAY →"}
        </Link>
      </div>
    </main>
  );
}
