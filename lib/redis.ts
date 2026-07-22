import { Redis } from "@upstash/redis";

// Same client local + prod. Env vars switch backend:
//   local  -> SRH proxy (docker), http://localhost:8079
//   deploy -> Upstash REST URL
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
