import { redis } from "./redis";
import { key } from "./server-api";
import { isValidPid } from "./leaderboard-core";
export type PublicPlayer = { initials?: string; best?: number | string; streak?: number | string; legacy?: boolean };
export async function publicPlayer(pid: string): Promise<PublicPlayer | null> {
  if (!isValidPid(pid)) return null;
  try {
    const current = await redis.hgetall<PublicPlayer>(key(`player:${pid}`));
    if (current?.best != null) return current;
    const production = process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");
    if (!production) return null;
    const historical = await redis.hgetall<PublicPlayer>(`player:${pid}`);
    return historical?.best != null ? { ...historical, legacy: true } : null;
  } catch { return null; }
}
