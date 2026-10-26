import { Redis } from "@upstash/redis";

// Same client local + prod. Env vars switch backend:
//   local  -> SRH proxy (docker), http://localhost:8079
//   deploy -> Upstash REST URL
let client: Redis | undefined;
// Lazy construction allows builds without secrets. Runtime API errors become
// retryable 503s; missing configuration must never silently drop a write.
export const redis = new Proxy({} as Redis, {
  get(_target, property) {
    if (!client) {
      const url = process.env.KV_REST_API_URL;
      const token = process.env.KV_REST_API_TOKEN;
      if (!url || !token) throw new Error("Redis is not configured");
      client = new Redis({ url, token });
    }
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
