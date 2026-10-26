import { redis } from "@/lib/redis";
import { playerNameError, cleanPlayerName } from "@/lib/player-name";
import { dayKey, yesterdayKey } from "@/lib/leaderboard-core";
import { scoreRun } from "@/lib/run-validation";
import type { Difficulty } from "@/lib/game-rules";
import { ApiError, body, endpoint, hash, ipLimit, json, key, rateLimit, requireSession, sameOrigin } from "@/lib/server-api";
import { COMMIT_RUN } from "@/lib/score-scripts";

export const POST = endpoint(async (req) => {
  sameOrigin(req);
  await ipLimit(req, "score", 120, 60);
  const auth = await requireSession(req);
  await rateLimit(`score:${auth.pid}`, 30, 60);
  const data = await body(req);
  if (typeof data.runId !== "string" || !/^[a-f0-9-]{36}$/.test(data.runId)) throw new ApiError(400, "Invalid run");
  const nameError = playerNameError(data.initials);
  if (nameError) throw new ApiError(400, nameError);
  const runKey = key(`run:${data.runId}`);
  const run = await redis.hgetall<{ pid: string; mode: Difficulty; version: number; startedAt: number }>(runKey);
  if (!run || run.pid !== auth.pid || Number(run.version) !== auth.version) throw new ApiError(410, "Run expired or reset. Start a new game.");
  const score = scoreRun(data.events, data.durationMs, Date.now() - Number(run.startedAt), run.mode);
  if (score === null) throw new ApiError(400, "Run failed score validation");
  const fingerprint = hash(JSON.stringify([data.events, data.durationMs]));
  const today = dayKey();
  const result = await redis.eval<(string | number)[], string>(COMMIT_RUN, [
    runKey, key(`player:${auth.pid}`), key(`board:${run.mode}`), auth.sessionKey,
  ], [auth.pid, auth.version, score, cleanPlayerName(data.initials), today, yesterdayKey(today), fingerprint, run.mode]);
  if (result === "expired") throw new ApiError(410, "Run expired or reset. Start a new game.");
  if (result === "conflict") throw new ApiError(409, "This run was already submitted with different results");
  return json(typeof result === "string" ? JSON.parse(result) : result);
});
