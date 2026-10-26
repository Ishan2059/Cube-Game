import { playerNameError, cleanPlayerName } from "@/lib/player-name";
import { redis } from "@/lib/redis";
import { ApiError, body, endpoint, ipLimit, json, key, requireSession, sameOrigin } from "@/lib/server-api";

export const POST = endpoint(async (req) => {
  sameOrigin(req);
  await ipLimit(req, "rename", 20, 60);
  const auth = await requireSession(req);
  const data = await body(req, 1024);
  const error = playerNameError(data.initials);
  if (error) throw new ApiError(400, error);
  const initials = cleanPlayerName(data.initials);
  const ok = await redis.eval<(string | number)[], number>(`
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    redis.call('HSET', KEYS[2], 'initials', ARGV[2]); return 1`,
  [auth.sessionKey, key(`player:${auth.pid}`)], [auth.pid, initials]);
  if (!ok) throw new ApiError(401, "Session expired");
  return json({ initials });
});
