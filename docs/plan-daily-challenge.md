# Plan: Daily Challenges for CRUSH

**Status:** Ready for execution · **Scope:** Goal-based dailies, 3/day (easy/medium/hard), local-only, streaks + badges + points currency · **Out of scope:** backend/leaderboards, seeded runs, modifier runs, skin shop UI (points are banked now, spent later)

## 1. Context

CRUSH is a Next.js 15 + React 19 + Three.js arcade game. All game logic lives in `game/engine.ts` behind `startGame(container): disposer`. Persistence today is a single `localStorage` key (`crush-best`). No test framework; verification = `npm run build`, `npm run lint`, manual playtest via `npm run dev`.

Player calibration: **average run ≈ 100,000 pts** (reaches AMBER–EMERALD, lvl 15–16 of 20). Difficulty must be gated by *depth* (late-game-only feats), not just volume.

## 2. Architecture

```
engine.ts  ──hooks.onStats(stats, "live"|"end")──▶  Game.tsx  ──▶  daily.ts (evaluate + persist)
                                                                │
                          "crush:daily" CustomEvent ◀───────────┘
                                          │
                                          ▼
                              DailyGoals.tsx (re-render)
```

- **`game/daily.ts` (new)** — pure, framework-free module: challenge definitions, seeded daily selection, storage, evaluation. No imports from engine (types duplicated/structural where needed).
- **`game/engine.ts`** — instruments a `RunStats` object; `startGame(container, hooks?)` reports it.
- **`components/Game.tsx`** — wires `hooks.onStats` → `daily.applyStats`, shows completion toasts.
- **`components/DailyGoals.tsx` (new)** — start-screen card + game-over summary; listens for `"crush:daily"`.
- **`app/page.tsx`**, **`app/globals.css`** — mount points + styles.

## 3. Data model

### 3.1 Challenge definitions

```ts
type Tier = "easy" | "medium" | "hard";
type StatKey =
  | "score" | "kills" | "killsOfType" | "armoredBeetleKills"
  | "bestCombo" | "rampages" | "noBiteScore" | "grinds"
  | "hearts" | "eggKills" | "bestStreak" | "levelReached" | "timeSurvived";

interface ChallengeDef {
  id: string;
  tier: Tier;
  text: string;          // display, e.g. "Score 50,000 in one run"
  stat: StatKey;
  parasite?: string;     // only for killsOfType
  target: number;
  perRun: boolean;       // true = single run (take max); false = day total (sum)
  reward: number;        // points: easy 25 / medium 50 / hard 100
}
```

### 3.2 Challenge pool (calibrated to ~100k average runs)

**Easy (25 pts) — ~1 average run:**

| id | text | stat | target | perRun |
|---|---|---|---|---|
| `e-warmup` | Score 50,000 in one run | score | 50000 | ✓ |
| `e-cobalt` | Reach LVL 11 · COBALT | levelReached | 10 (index) | ✓ |
| `e-pest` | Crush 250 parasites today | kills | 250 | — |
| `e-rampage3` | Trigger RAMPAGE 3× in one run | rampages | 3 | ✓ |
| `e-combo10` | Reach a ×10 combo in one run | bestCombo | 10 | ✓ |
| `e-grind10` | Grind 10 latched bugs today | grinds | 10 | — |
| `e-omelette` | Crush 8 egg sacs today | eggKills | 8 | — |
| `e-survive3` | Survive 3 minutes in one run | timeSurvived | 180 | ✓ |

**Medium (50 pts) — at/above average:**

| id | text | stat | target | perRun |
|---|---|---|---|---|
| `m-sixfig` | Score 125,000 in one run | score | 125000 | ✓ |
| `m-emerald` | Reach LVL 17 · EMERALD | levelReached | 16 | ✓ |
| `m-ext500` | Crush 500 parasites today | kills | 500 | — |
| `m-rampage6` | Trigger RAMPAGE 6× in one run | rampages | 6 | ✓ |
| `m-combo16` | Reach a ×16 combo in one run | bestCombo | 16 | ✓ |
| `m-untouch15k` | Score 15,000 without a bite, one run | noBiteScore | 15000 | ✓ |
| `m-beetle30` | Crush 30 beetles today | killsOfType: beetle | 30 | — |
| `m-survive5` | Survive 5 minutes in one run | timeSurvived | 300 | ✓ |
| `m-streak25` | Reach a 25 kill streak in one run | bestStreak | 25 | ✓ |

**Hard (100 pts) — mastery, well above average:**

| id | text | stat | target | perRun |
|---|---|---|---|---|
| `h-void` | Reach LVL 20 · VOID | levelReached | 19 | ✓ |
| `h-250k` | Score 250,000 in one run | score | 250000 | ✓ |
| `h-genocide` | Crush 900 parasites today | kills | 900 | — |
| `h-rampage10` | Trigger RAMPAGE 10× in one run | rampages | 10 | ✓ |
| `h-combo25` | Reach a ×25 combo in one run | bestCombo | 25 | ✓ |
| `h-flawless40k` | Score 40,000 without a bite, one run | noBiteScore | 40000 | ✓ |
| `h-armored25` | Crush 25 armored beetles today | armoredBeetleKills | 25 | — |
| `h-survive8` | Survive 8 minutes in one run | timeSurvived | 480 | ✓ |
| `h-streak40` | Reach a 40 kill streak in one run | bestStreak | 40 | ✓ |

### 3.3 RunStats (engine → daily contract)

```ts
interface RunStats {
  score: number;
  kills: number;
  killsByType: Record<string, number>;
  armoredBeetleKills: number;   // beetles whose spawn hp was > 1 (level armor > 0)
  bestCombo: number;
  rampages: number;             // count of rampage *activations*
  bites: number;
  noBiteScore: number;          // score frozen at first bite; final score if never bitten
  grinds: number;               // latched parasites ground off by rolling
  hearts: number;
  eggKills: number;             // eggsac crushes (always pre-hatch)
  bestStreak: number;
  levelReached: number;         // max LEVELS index this run
  timeSurvived: number;         // seconds
}
```

### 3.4 localStorage schema

```
crush-daily-v1: {
  date: "YYYY-MM-DD",                        // local date
  challenges: [{ id: string, progress: number, done: boolean }]  // length 3
}
crush-meta-v1: {
  points: number,                            // banked currency for future skins
  streak: number,
  lastStreakDate: "YYYY-MM-DD",              // last day streak was advanced
  badges: string[]                           // dates (YYYY-MM-DD) where all 3 completed
}
```

Both reads are `try/catch` + shape-validated; corrupt/missing data → reinitialize. Guard `localStorage` access (private mode) with an in-memory fallback.

## 4. `game/daily.ts` — detailed spec

Exported API:

```ts
getToday(now?: Date): DailyState                  // lazy-creates/resets on date change
getMeta(): MetaState
applyStats(stats: RunStats, phase: "live" | "end", now?: Date): ChallengeDef[] // returns newly completed
```

Internals:

1. **Seeded selection:** `mulberry32(YYYYMMDD_int)`; for each tier, `floor(rand() * tierPool.length)`; if the pick equals yesterday's id, advance to the next pool entry. Deterministic → same 3 challenges for everyone on a date. `now` is injectable everywhere for testing.
2. **Progress evaluation:** for each active challenge, extract the stat (`killsOfType` → `stats.killsByType[def.parasite] ?? 0`). `perRun` → `progress = max(progress, value)`; day-total → accumulate per-run deltas. Because `"live"` fires many times per run with cumulative stats, day-total challenges must only accumulate on `phase === "end"` (delta = run's final value), while `perRun` challenges may update on both phases.
3. **Completion:** on `progress >= target` and not already done: mark done, add `reward` to `meta.points`, collect into the newly-completed return array. If all 3 done and today's date not in `meta.badges` → push it.
4. **Streak:** on the day's **first challenge completion**: if `lastStreakDate === yesterday` → `streak++`; if it's today → unchanged; otherwise → `streak = 1`. Set `lastStreakDate = today`.
5. **Events:** after every storage write, `window.dispatchEvent(new CustomEvent("crush:daily"))` (guard `typeof window` for SSR/imports).

## 5. `game/engine.ts` — instrumentation (minimal diffs at existing sites)

1. Add to `GameState`: `stats: RunStats` (fresh zeroed object; also reset in `resetGame`).
2. Add to `Parasite` interface: `armored: boolean` — set in `addParasite` (`type === "beetle" && (LEVELS[S.level].armor ?? 0) > 0`).
3. **`addKill(pz)`** (≈ line 1182): `kills++`, `killsByType[pz.type]++`, `bestCombo = max(bestCombo, S.combo)`, `bestStreak = max(bestStreak, S.streak)`, in the `S.rampage && !wasRampage` branch → `rampages++`, `if (pz.type === "eggsac") eggKills++`, `if (pz.armored) armoredBeetleKills++`. (Kill-side of beetles happens in `crushList` — increment `armoredBeetleKills` there where the victim is actually removed, using `pz.armored`.)
4. **`applyBite`** (≈ 1220): `bites++; if (bites === 1) noBiteScore = S.score`.
5. **`grindLatchedAfterRoll`** (≈ 1400): `grinds += crushed.length`.
6. **`collectHeart`** (≈ 1279): `hearts++`.
7. **In `tick` / `addKill`:** keep `levelReached = max(levelReached, S.level)` (or read `S.level` at report time — simpler: compute at report).
8. **Signature:** `startGame(container: HTMLElement, hooks?: { onStats?: (s: RunStats, phase: "live" | "end") => void })`.
9. **Reporting:** snapshot builder `currentStats()` (`noBiteScore = bites === 0 ? S.score : noBiteScore`; `levelReached = S.level`; `timeSurvived = S.time`). Fire `"live"` from `tick` throttled to ~2 Hz while `S.running && !S.paused`; fire `"end"` inside `gameOver()` (≈ 1554) before showing the screen.

## 6. UI

**`components/Game.tsx`:** pass `hooks.onStats = (stats, phase) => { const done = applyStats(stats, phase); done.forEach(d => showDailyToast(d)); }`. `showDailyToast` writes into `#daily-toast` (text: `✓ {text} · +{reward} pts`), re-triggering a CSS animation; auto-hides after ~2.5s. Multiple completions queue (simple array + interval).

**`components/DailyGoals.tsx` (new):** `"use client"`; state = `getToday()` + `getMeta()`; `useEffect` subscribes to `"crush:daily"` + `storage` events. Renders:
- Start-screen card (`#daily-card`): title `DAILY GOALS`, 3 rows: tier chip (E/M/H, colored), text, progress `current/target` with bar, reward pts, ✓ state; footer: `🔥 {streak} day streak · {points} pts`.
- Game-over variant (`compact` prop): only challenges whose progress changed this run + completions.

**`app/page.tsx`:** render `<DailyGoals />` inside `#start-screen` (above `#start-btn`) and `<DailyGoals compact />` inside `#gameover-screen`; add `<div id="daily-toast" />` next to `#popups`.

**`app/globals.css`:** card matching existing overlay aesthetic (dark panel, same fonts/borders), tier chips (easy green / medium amber / hard red), animated progress bars, toast slide-in/fade. Keep styles scoped under `#daily-card` / `#daily-toast` to avoid touching existing rules.

## 7. Behavior & edge cases

- **Day rollover mid-run:** run credited to the date at `gameOver()` time (`applyStats` re-resolves `getToday(now)` on `"end"`).
- **No consecutive-day repeats:** seeded pick excludes yesterday's id per tier.
- **Multiple tabs:** last write wins (accepted).
- **SSR safety:** `daily.ts` only touches `localStorage`/`window` inside functions, never at module top level.
- **Clock tampering:** accepted (local-only game).
- **Schema evolution:** keys are `v1`-suffixed.

## 8. Verification

1. `npm run build` and `npm run lint` clean.
2. **Determinism/variety:** temporary script via `npx tsx` iterating 14 consecutive dates → exactly 1 challenge per tier per day, no same-day dupes, no consecutive-day id repeats. (Delete script after, or keep as `scripts/preview-daily.ts`.)
3. **Manual matrix** (`npm run dev`):
   - Progress bars advance during a run (2 Hz live updates).
   - Completion toast fires once per challenge; ✓ + points persist after reload.
   - Day-total challenge accumulates across multiple runs; per-run challenge takes the max.
   - Streak increments on first completion; badge recorded on 3/3 (verify via DevTools `localStorage`).
   - Day rollover: temporarily call `applyStats(stats, "end", new Date("2026-07-20"))` from console to confirm reset + new selection.

## 9. Tuning & follow-ups

- All targets/rewards live in **one table** in `daily.ts` — tune after real play data (optionally log run-end stats via the existing `@vercel/analytics` to get true kill/time distributions).
- Banked `points` are designed to become the skin-shop currency; unlockable cube skins plug into the existing `applyLevel` skin mechanism later.
- Natural next steps (separate plans): modifier days, seeded Wordle-style run, backend leaderboard.
