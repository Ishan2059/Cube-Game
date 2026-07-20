# Share-to-Social Feature Plan

Score sharing for Cube-Game (Crush), framed as a **player-retention engine**, not a vanity button. Builds on the existing leaderboard (`docs/leaderboard/leaderboard_plan.md`).

## Goal

Turn every game-over into a **viral loop**:

```
player scores → shares card → friend sees it → friend clicks → friend plays → friend shares
```

Retention comes from two forces:
1. **Pull-back** — the sharer gets a link *about them* (their rank/streak). Coming back to beat it is the hook.
2. **Acquisition (K-factor)** — each share lands a friend on a "Beat SCORE" page that drops them straight into the game.

The leaderboard makes players come back daily; sharing makes players **bring other players**. That's the engine.

## Stack (no new dependencies)

| Need | Use | Why not a library |
|------|-----|-------------------|
| Share sheet | `navigator.share()` (Web Share API) | Native on mobile. ShareThis/AddThis = trackers + bloat. |
| Desktop fallback | Copy-link + `x.com/intent` + `wa.me` / `t.me` intent URLs | Plain `<a href>`, no SDK. |
| Unfurl card image | `next/og` `ImageResponse` via `opengraph-image.tsx` file convention | Built into Next 15. No `@vercel/og` install, no manual `<meta>`. |
| Share landing page | new server route `app/c/[pid]/page.tsx` | Reuses existing Redis `player:<pid>` hash. |

Everything runs on the Redis + Next stack already in place. **Zero `package.json` changes.**

## The viral loop, concretely

### 1. Share trigger (client) — `game/leaderboard.ts`
Add `shareScore()`:
```ts
const url = `${location.origin}/c/${getPid()}`;
const text = `I hit ${score} in Crush 🔥${streak}. Beat me:`;
if (navigator.share) await navigator.share({ title: "Crush", text, url });
else copyToClipboard(`${text} ${url}`);   // desktop fallback + toast
```
- Web Share API needs a **user gesture** — wire to a button click, not auto-fire.
- `ponytail: single native share sheet covers iOS/Android/desktop-Chrome. Add per-network intent buttons only if analytics show desktop share drop-off.`

### 2. Share button (DOM) — `app/page.tsx` `#gameover-screen`
One button near `#daily-streak` (line ~101):
```html
<button id="share-btn">Share score 📲</button>
```
Wire in `gameOver()` after `submitScore()` resolves (needs the returned streak/rank).

**Nudge, don't spam.** Only surface/emphasize share on a moment worth bragging:
- new personal best, OR
- streak milestone (3/7/14/30), OR
- top-10 daily rank.

Otherwise show it muted. `submitScore` already returns `rank`, `best`, `streak` — enough to decide client-side. No extra API.

### 3. Landing page — `app/c/[pid]/page.tsx` (NEW, server component)
The retention payload. Friend (or the sharer, later) opens `/c/<pid>`:
- Read `player:<pid>` from Redis → `{ initials, best, streak }`.
- Render: "**ALEX** scored **12,340** 🔥7" + big **"Beat it — Play"** button linking to `/`.
- `generateMetadata()` sets `title`/`description` for the unfurl text.

### 4. Unfurl image — `app/c/[pid]/opengraph-image.tsx` (NEW)
Next's file convention: co-locating this auto-injects the `og:image` + `twitter:image` meta. **No manual tag wiring.**
```tsx
export default async function Image({ params }) {
  const p = await redis.hgetall(`player:${params.pid}`);
  return new ImageResponse(<ScoreCard initials={p.initials} best={p.best} streak={p.streak} />,
    { width: 1200, height: 630 });
}
```
When the link is pasted into Slack/X/WhatsApp/iMessage, this card image renders. The card **is** the ad.

`ponytail: card shows all-time best + current streak from the pid hash — no extra storage. If "I *just* scored X this run" freshness matters, pass ?s= and read it in generateMetadata. Deferred: crawlers cache og:image aggressively, so per-run images fight the cache anyway.`

## Attribution (the part that proves it works)

Without this you can't tell if sharing retains anyone. Cheap funnel counters in Redis:
- Share landing hit: `INCR share:land:<pid>` (in the page component).
- CTA click → `/` with `?ref=<pid>`; client reads it, fires `INCR share:play:<pid>`, stores referrer pid in localStorage `crush-ref` once.
- Daily rollup keys `share:land:<date>` / `share:play:<date>` for a crude K-factor (`plays / shares`).

`ponytail: two INCRs, no analytics vendor. Add PostHog/GA only when raw counts justify a dashboard.`

## Anti-abuse (trust boundary — not lazy)
- `pid` in route param: validate `^[a-z0-9-]{8,64}$` (same regex as `/api/score`) before any Redis read. Reject → 404, don't echo input.
- Unknown/empty `player:<pid>` → generic card ("Play Crush"), never a broken card or a 500. Missing hash is normal (old/cleared pid).
- OG route is public + unauthenticated by design; it only reads, never writes. Safe.

## Scope cuts (deliberate)
- **No image upload / canvas screenshot share.** Web Share `files` + a rendered canvas is v2. The unfurl card covers 90% of social surfaces for free.
- **No per-network SDKs** (FB SDK, X widgets). Intent URLs only.
- **No share-count leaderboard / referral rewards.** Add if K-factor climbs and you want to juice it.
- **No accounts** — inherits leaderboard's anonymous-pid model. Clear browser = new pid = new share identity. Acceptable.

## Files
| File | New? | Change |
|------|------|--------|
| `game/leaderboard.ts` | edit | `shareScore()` + clipboard fallback + toast |
| `app/page.tsx` | edit | `#share-btn` in game-over; `?ref=` read on load |
| `game/engine.ts` | edit | wire share button in `gameOver()` after submit resolves |
| `app/c/[pid]/page.tsx` | NEW | landing + `generateMetadata` + `share:land` INCR |
| `app/c/[pid]/opengraph-image.tsx` | NEW | dynamic score card |
| `lib/leaderboard-core.test.ts` | edit | assert share text/url builder + pid validation |

## Test
Extend existing `leaderboard-core.test.ts`: pure `buildShareText(score, streak)` + `buildShareUrl(origin, pid)` + reuse pid-validation assert. No live Redis, no framework — matches current test.

## Build order
1. `buildShareText` / `buildShareUrl` helpers + test (pure, first).
2. `shareScore()` in `game/leaderboard.ts` + `#share-btn` + `gameOver()` wire → native share works.
3. `app/c/[pid]/page.tsx` + `opengraph-image.tsx` → links unfurl.
4. `?ref=` read + `share:land` / `share:play` INCRs → funnel visible.
5. Smoke: share on mobile (real share sheet), paste link in Slack/X (check card), open in incognito (check "Beat it" → `/`).

## Blockers
- Unfurl testing needs a **public deploy URL** — crawlers can't reach localhost. Use the Vercel preview URL + a debugger (X card validator / Slack unfurl) to verify.
- `opengraph-image.tsx` runs on the edge/node runtime reading Redis — confirm `@upstash/redis` (HTTP REST) works in the OG route's runtime (it does; it's HTTP, not TCP).
