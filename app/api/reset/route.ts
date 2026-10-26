import { redis } from "@/lib/redis";
import { endpoint, ipLimit, json, key, session, sameOrigin } from "@/lib/server-api";
import { RESET_PLAYER } from "@/lib/score-scripts";

export const POST = endpoint(async (req) => {
  sameOrigin(req);
  await ipLimit(req, "reset", 10, 3600);
  const auth = await session(req);
  // Idempotent when the reset succeeded but its response was lost.
  if (auth) await redis.eval(RESET_PLAYER, [key(`player:${auth.pid}`), key("board:normal"), key("board:casual"), auth.sessionKey], [auth.pid]);
  return json({ ok: true });
});
