# Leaderboard Feature Plan

Retention-focused leaderboard for Cube-Game (Crush). Scope: **daily reset board + streak + neighbors**.

## Goal
Bring players back daily. Daily board resets each midnight (fresh #1 race), streaks punish missed days, neighbor view makes climbing feel reachable.

## Stack
- **Client**: existing vanilla DOM/TS game engine (`$("id")` + localStorage). No React state.
- **Store**: Redis sorted set = leaderboard primitive.
- **Client library**: `@upstash/redis` (HTTP REST) — one client for BOTH local and prod.
- **Env switching only** — no code branches between local and deploy.

### Local vs deploy (same client, env vars differ)
`@upstash/redis` speaks HTTP REST, not raw Redis protocol. Local Redis fronted by **SRH** (`serverless-redis-http`) proxy so the same client works locally.

| Env | `KV_REST_API_URL` | `KV_REST_API_TOKEN` | Backend |
|-----|--------------------|----------------------|---------|
| Local | `http://localhost:8079` | `dev_token` (any string, must match SRH) | Docker: redis + SRH |
| Deploy | real Upstash URL | real Upstash token | Upstash (Vercel Marketplace integration, `KV_*` names) |

Local dev via `docker-compose.yml`:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  srh:
    image: hiett/serverless-redis-http:latest
    ports: ["8079:80"]
    environment:
      SRH_MODE: env
      SRH_TOKEN: dev_token
      SRH_CONNECTION_STRING: "redis://redis:6379"
    depends_on: [redis]
```
`.env.local` (gitignored) points at localhost:8079. Vercel env vars point at Upstash. Zero code difference.

## Data model (Redis)
```
lb:<YYYY-MM-DD>   sorted set   daily board, TTL 48h (keep yesterday for delta)
player:<uuid>     hash         { initials, streak, lastPlayed, best }
```
- `uuid` = random id in localStorage key `crush-pid`. Anonymous, survives refresh, not cross-device.
- Skip weekly + all-time v1 — add later, one extra `ZADD` each.

## Files

### 1. `lib/redis.ts`
Upstash client from env. ~5 lines.
```ts
import { Redis } from "@upstash/redis";
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
```

### 2. `app/api/score/route.ts` — POST `{ pid, initials, score }`
Server-side guards (trust boundary — NOT lazy here):
- clamp `initials` to 3 chars, strip non-alphanumeric, uppercase
- reject `score` non-integer, negative, or `> MAX_SCORE` (constant cap, e.g. 100000)
- rate-limit: `SET rl:<pid> 1 NX EX 2` — 1 submit / 2s per pid

Then:
- `ZADD lb:<today> GT <score> <pid>` (`GT` = keep best, not last)
- streak: read `player:<pid>.lastPlayed`
  - `== today` → streak unchanged
  - `== yesterday` → streak + 1
  - else → streak = 1
- write `player:<pid>` = `{ initials, streak, lastPlayed: today, best: max(best, score) }`
- return `{ rank, total, streak, best, neighbors }`

### 3. `app/api/leaderboard/route.ts` — GET `?pid=`
- `ZREVRANGE lb:<today> 0 9 WITHSCORES` → top 10
- `ZREVRANK lb:<today> pid` → my rank; `ZCARD` → total
- neighbors: `ZREVRANGE lb:<today> (rank-2) (rank+2) WITHSCORES`
- resolve pids → initials via `player:<uuid>` (pipeline)
- return `{ top10, myRank, total, neighbors }`

### 4. `app/api/me/route.ts` — GET `?pid=`
Home streak-at-risk hook. Reads `player:<uuid>` → `{ initials, streak, lastPlayed, best }`.
`ponytail: fold into /api/leaderboard if a 3rd route feels heavy.`

### 5. `game/leaderboard.ts` (new, vanilla — matches engine style)
- `getPid()` — read/create `crush-pid` in localStorage
- `getInitials()` / `setInitials(s)` — localStorage `crush-initials`
- `submitScore(score)` — POST /api/score, return rank/streak/neighbors
- `fetchBoard()` — GET /api/leaderboard
- `renderBoard(el, data)` — top-10 + "YOU: #847 of 3201" + neighbor rows

### 6. `game/engine.ts` `gameOver()` (line ~1554)
After existing localStorage best write:
- `submitScore(S.score)`, render into `#leaderboard`
- show `🔥{streak}` on game-over screen

### 7. `app/page.tsx` `#gameover-screen` (line ~93)
Add:
- initials input (prefilled from `crush-initials`, editable — set once default, editable each game-over)
- `<div id="leaderboard"></div>` (top10 + neighbors render target)
- streak line

### 8. `app/page.tsx` `#start-screen` — streak-at-risk hook
On load, `GET /api/me?pid=`. If `lastPlayed == yesterday` → show `🔥{streak} — play today to keep it`.

## Initials UX
Set once on first play → stored in `crush-initials`. Prefilled + editable field on every game-over. Edit persists to localStorage + next submit.

## Anti-cheat (deliberately deferred)
v1 = score cap + rate-limit only. Client can still fake within cap.
`ponytail: add HMAC-signed run token / server-side score validation when fake scores actually appear.`

## Scope cuts (deliberate)
- No weekly / all-time board — add when daily proves retention.
- No accounts — clear browser = lose streak/best. Acceptable v1.
- No push/email — only home streak-at-risk banner.
- No storage abstraction — direct `@upstash/redis`, swap via env not interface.

## Test
`test_score.ts` — assert streak transitions (today / yesterday / gap), score clamp, rank math against a mock redis. One runnable check, no framework. Runs without live Redis.

## Build order
1. `docker-compose.yml` + `.env.local` + `lib/redis.ts`
2. `game/leaderboard.ts` (pid, initials, submit, render) + mocked `test_score.ts`
3. `app/api/score` + `app/api/leaderboard` + `app/api/me`
4. Wire `gameOver()` + `#gameover-screen` DOM
5. Home streak-at-risk hook
6. Smoke-test local (docker up), then deploy with Upstash vars

## Blockers
- Local: `docker compose up` for redis + SRH.
- Deploy: Upstash provisioned via Vercel integration, 2 env vars set. (User handles.)
- Streak-logic test runs without any Redis.
