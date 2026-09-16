import type { Redis } from "@upstash/redis";

export const ALL_TIME_BOARD_KEY = "lb:all-time";
const BACKFILL_KEY = "lb:all-time:backfilled:v1";

// Old daily boards expire, but player hashes retain historical personal bests.
// Backfill once on first use, including players who never return to submit again.
// GT makes retries and concurrent backfills safe alongside new submissions.
export async function ensureAllTimeBoard(
  redis: Pick<Redis, "get" | "scan" | "pipeline" | "set">,
): Promise<void> {
  if (await redis.get(BACKFILL_KEY)) return;

  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { match: "player:*", count: 100 });
    cursor = String(next);
    if (!keys.length) continue;

    const reads = redis.pipeline();
    keys.forEach((key) => reads.hget(key, "best"));
    const scores = await reads.exec();
    const writes = redis.pipeline();
    let count = 0;
    scores.forEach((raw, i) => {
      if (raw === null || raw === undefined) return;
      const score = Number(raw);
      if (!Number.isInteger(score) || score < 0) return;
      writes.zadd(ALL_TIME_BOARD_KEY, { gt: true }, {
        score,
        member: keys[i].slice("player:".length),
      });
      count++;
    });
    if (count) await writes.exec();
  } while (cursor !== "0");

  // Only mark complete after every batch succeeds; failures can safely retry.
  await redis.set(BACKFILL_KEY, 1);
}
