import { Redis } from "@upstash/redis";

// Same client local + prod. Env vars switch backend:
//   local  -> SRH proxy (docker), http://localhost:8079
//   deploy -> Upstash REST URL
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
