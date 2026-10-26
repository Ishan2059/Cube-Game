import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { redis } from "./redis";

const COOKIE = process.env.NODE_ENV === "production" ? "__Host-crush-session" : "crush-session";
const SESSION_TTL = 365 * 24 * 60 * 60;
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const key = (suffix: string) => {
  // Preview deployments can never write production keys, even if credentials
  // were accidentally copied. Use a separate database as an additional boundary.
  const environment = process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  return `crush:v2:${environment}:${process.env.REDIS_NAMESPACE || "default"}:${suffix}`;
};
export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function endpoint(handler: (req: Request) => Promise<NextResponse>) {
  return async (req: Request) => {
    try { return await handler(req); }
    catch (error) {
      const known = error instanceof ApiError;
      if (!known) {
        // Do not log request bodies, cookies, Redis URLs, or tokens.
        console.error("API unavailable", new URL(req.url).pathname, error instanceof Error ? error.name : "UnknownError");
        if (process.env.NODE_ENV === "test") console.error(error);
      }
      const response = json({ error: known ? error.message : "Service unavailable. Please retry." }, known ? error.status : 503);
      if (known && error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
  };
}
export function sameOrigin(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin || req.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "Cross-origin request rejected");
  }
}
export async function body(req: Request, limit = 2_000_000): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "JSON required");
  if (Number(req.headers.get("content-length")) > limit) throw new ApiError(413, "Request too large");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new ApiError(413, "Request too large"); }
    chunks.push(value);
  }
  try {
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return result;
  } catch { throw new ApiError(400, "Invalid JSON"); }
}
// Only trust Vercel's overwritten forwarding header on Vercel. Other hosts share
// a conservative bucket until a trusted proxy adapter is configured.
function clientAddress(req: Request) {
  return process.env.VERCEL === "1" ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "unknown" : "local";
}
const RATE_SCRIPT = `local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`;
export async function rateLimit(bucket: string, limit: number, seconds: number) {
  const count = await redis.eval<(string | number)[], number>(RATE_SCRIPT, [key(`rate:${bucket}`)], [seconds]);
  if (count > limit) throw new ApiError(429, "Too many requests. Please retry.", seconds);
}
export async function ipLimit(req: Request, action: string, limit: number, seconds: number) {
  await rateLimit(`${action}:${hash(clientAddress(req))}`, limit, seconds);
}
export type Session = { pid: string; version: number; sessionKey: string };
export async function session(req: Request): Promise<Session | null> {
  const token = req.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const sessionKey = key(`session:${hash(token)}`);
  const pid = await redis.get<string>(sessionKey);
  if (!pid) return null;
  const version = Number(await redis.hget(key(`player:${pid}`), "version") ?? 0);
  return { pid, version, sessionKey };
}
export async function requireSession(req: Request) {
  const found = await session(req);
  if (!found) throw new ApiError(401, "Your session expired. Start a new game.");
  return found;
}
export async function createSession(req: Request) {
  sameOrigin(req);
  const existing = await session(req);
  if (existing) return json({ pid: existing.pid });
  await ipLimit(req, "session", 20, 3600);
  const token = randomBytes(32).toString("hex");
  const pid = randomUUID();
  await redis.set(key(`session:${hash(token)}`), pid, { ex: SESSION_TTL });
  const response = json({ pid });
  response.cookies.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_TTL });
  return response;
}
