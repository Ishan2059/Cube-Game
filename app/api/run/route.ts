import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { RUN_TTL } from "@/lib/game-rules";
import { ApiError, body, endpoint, ipLimit, json, key, rateLimit, requireSession, sameOrigin } from "@/lib/server-api";

export const POST = endpoint(async (req) => {
  sameOrigin(req);
  await ipLimit(req, "run", 120, 600);
  const auth = await requireSession(req);
  await rateLimit(`run:${auth.pid}`, 30, 600);
  const data = await body(req, 1024);
  if (data.mode !== "normal" && data.mode !== "casual") throw new ApiError(400, "Invalid difficulty");
  const runId = randomUUID();
  const runKey = key(`run:${runId}`);
  const tx = redis.multi();
  tx.hset(runKey, { pid: auth.pid, version: auth.version, mode: data.mode, startedAt: Date.now() });
  tx.expire(runKey, RUN_TTL);
  await tx.exec();
  return json({ runId, pid: auth.pid, mode: data.mode, expiresAt: Date.now() + RUN_TTL * 1000 });
});
