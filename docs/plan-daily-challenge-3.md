# Plan v3: Daily Challenges as a Playstyle Forcer

**Companion to** `plan-daily-challenge.md` (v1, engineering) and `plan-daily-challenge-2.md` (v2, retention addendum). v1 gave the engineering skeleton; v2 added the habit-loop fixes. **v3 rethinks everything** under a changed context: the daily-reset leaderboard and the cosmetic-skin shop are now owned by other teams. v1/v2 still hold their engineering skeleton; v3 overrides the tier definitions, challenge pool, economy shape, and UI intent.

This is an **idea plan**, not a build plan. A separate implementation doc follows once the open external items (§11) are settled with the skins team.

---

## 1. Context shift

The original plan was the *retention engine carrying its own reward loop* (points → future skin shop). The world has now split into three roles owned separately:

| System | Owner | Job | Player feeling |
|---|---|---|---|
| Daily leaderboard | other team | competitive performance / social | "I was best today" |
| Cosmetic skins | other team | long-run progression / identity | "this is my cube" |
| **Daily challenges** | this plan | **playstyle variety + habit** | "today I have to play *weird*" |

Two consequences drive the rethink:

1. **A daily-reset leaderboard and stat-count dailies compete for the same moment.** If the leaderboard already crowns "best score today" and resets every midnight, any daily whose text reads "score more than X" or "reach level Y" is redundant — it does what the leaderboard does, only worse (less social, no ranking).
2. **The points → future-skin-shop anchor is gone.** The skins team owns the sink; the dailies just feed the currency. Points survive (cross-team use confirmed), but the *psychological* weight of points is no longer "save up for the reward you built" — it's "feed the team's currency you don't control."

So the dailies' job, crisply, is the **one thing the leaderboard cannot do**: make players play *differently*, not play *better*. The moat is playstyle, not performance.

## 2. Core principle

> Every daily must either **constrain behavior** (play against your habits) or **push a non-score mechanic** (grinding, tempo, restraint, recovery, no-rampage, no-heart). No daily may be `score > X` or `level > X` alone — those belong to the leaderboard.

This is the spine of v3. It propagates into tiers, pool, UI copy, and even the retention math: the churn-protection model from v2 still applies, but the *rewarding-feeling* once the player returns now comes from "today's set is weird," not "today I can grind points."

## 3. Tier redesign — by experience, not difficulty

v1/v2 used easy/medium/hard as a score-ceiling ladder. That ladder is owned by the leaderboard. Replace it with three orthogonal experience roles; **one of each per day**:

- **SPARK** — the guaranteed-feel-good win. Always clearable in one sub-average run, or chipable across the day. The "open-the-card-and-smug-grin" hook (v2's day-1 retention floor).
- **FLOW** — mid-run skill variety that *complements* your natural leaderboard play (combos, streaks, rampage tempo, light no-bite). Doesn't fight the leaderboard grind.
- **STRETCH** — play *against* the leaderboard optimum (constraints: no RAMPAGE, no grind, kill-fast, kill-efficient). The only place the player can get what the leaderboard structurally can't reward.

Tier colors: SPARK yellow / FLOW blue / STRETCH red — readable at a glance.

## 4. The pool

Each challenge is tagged with an **axis** (combo / rampage / streak / no-bite / grind / creature / kills-by-time / no-rampage / no-heart / eggs). The selection rule (§5) uses axis tags so no single day's three challenges share a category.

### SPARK · 25 pts 🟡 rewards TODO · clearable in one weak run or chipable today

| id | axis | text | perRun |
|---|---|---|---|
| `sp-combo6` | combo | Reach ×6 combo | ✓ |
| `sp-rampage1` | rampage | Trigger RAMPAGE once | ✓ |
| `sp-combo5fast` | combo | ×5 combo within the first 20s | ✓ |
| `sp-grind5` | grind | Grind 5 latched bugs | ✓ |
| `sp-grind12today` | grind | Grind 12 latched bugs today | — |
| `sp-bitefree3k` | no-bite | 3,000 no-bite | ✓ |
| `sp-eggs3` | eggs | Crush 3 egg sacs | ✓ |
| `sp-pest80` | kills-by-time | Crush 80 parasites today | — |
| `sp-survive90` | (time) | Survive 90s | ✓ |
| `sp-level5` | (level) | Reach LVL 5 · COBALT | ✓ |
| `sp-beetle8today` | creature | Crush 8 beetles today | — |
| `sp-nobite-level3` | no-bite | Reach LVL 3 with zero bites | ✓ |
| `sp-pest30in60` | kills-by-time | Crush 30 parasites in the first 60s | ✓ |
| `sp-rampage-kill10` | rampage | Trigger RAMPAGE then crush 10 bugs before it ends | ✓ |

### FLOW · 50 pts 🟡 · mid-run skill variety, complements natural play

| id | axis | text | perRun |
|---|---|---|---|
| `fl-combo16` | combo | Reach ×16 combo | ✓ |
| `fl-combo20` | combo | Reach ×20 combo | ✓ |
| `fl-rampage6` | rampage | Trigger RAMPAGE ×6 | ✓ |
| `fl-rampage-fast` | rampage | Trigger RAMPAGE twice within 30s of each other | ✓ |
| `fl-streak25` | streak | Reach a 25 kill streak | ✓ |
| `fl-streak40` | streak | Reach a 40 kill streak | ✓ |
| `fl-untouch15k` | no-bite | 15k without a bite | ✓ |
| `fl-untouch25k` | no-bite | 25k without a bite | ✓ |
| `fl-grind20` | grind | Grind 20 latched bugs | ✓ |
| `fl-beetle30today` | creature | Crush 30 beetles today | — |
| `fl-triple10` | combo | Land three distinct ×10+ combos | ✓ |
| `fl-combo-hold60` | combo | Keep a single combo alive for 60 consecutive seconds | ✓ |
| `fl-hot60` | combo+rampage | ×12 combo AND trigger RAMPAGE twice within a 60s window | ✓ |
| `fl-flawless-combo12` | combo+no-bite | Score 12k AND reach ×12 combo, no bite | ✓ |

### STRETCH · 100 pts 🟡 · structurally caps leaderboard scoring — the moat

| id | axis | text | perRun | Why it caps score |
|---|---|---|---|---|
| `st-norampage10` | no-rampage | Reach LVL 10 without ever triggering RAMPAGE | ✓ | no rampage-cascade |
| `st-norampage-emerald` | no-rampage | Reach LVL 17 · EMERALD, no RAMPAGE | ✓ | harder; deep-game cap |
| `st-nobite8` | no-bite | Reach LVL 8 with zero bites | ✓ | defensive == slow |
| `st-nobite-emerald` | no-bite | Reach LVL 17 · EMERALD, zero bites | ✓ | harder |
| `st-lowkill10` | efficiency | Reach LVL 10 with <80 total kills | ✓ | anti-volume |
| `st-fast100` | speed | Reach 100 kills in under 60s | ✓ | anti-defensive speedrun |
| `st-grindonly30` | grind | Reach 30 grind-kills in one run | ✓ | grinding < rampage for score |
| `st-eggsfast5` | eggs | Crush 5 egg sacs before any hatch | ✓ | forces pre-hatch focus |
| `st-noheart12` | no-heart | Reach LVL 12 without picking up any hearts | ✓ | risky spacing, no recovery |
| `st-recover80k` | resilience | Score 80k after being bitten in the first 30s | ✓ | early bite caps perfect-run |
| `st-combo-hold120` | combo | Keep a single combo alive for 120 consecutive seconds | ✓ | anti-reckless sustain |
| `st-norampage-fast80` | no-rampage+speed | Reach 80 kills in 60s without ever triggering RAMPAGE | ✓ | compound: rare skill |
| `st-pacifist-emerald` | efficiency | Reach LVL 17 · EMERALD with <200 total kills | ✓ | marathon-pacifist |
| `st-flawless-fast-emerald` | no-bite+speed | Reach EMERALD no-bite AND under 4 minutes | ✓ | compound mastery |

## 5. Selection rule

1. Seed = `mulberry32(YYYYMMDD_int)`.
2. Roll one id per tier.
3. **Reject if its axis was already used by another tier today** — re-roll once; if still collision, advance one pool slot.
4. Reject same id as yesterday at the same tier (advance one slot if collision).
5. Result: exactly one SPARK, one FLOW, one STRETCH per day; no two challenges share an axis on a given day.

This guarantees day-to-day qualitative dissimilarity — yesterday's "grind-heavy card" is never followed by another grind-heavy card.

## 6. Engine instrumentation (RunStats delta)

Existing sufficient: `score`, `kills`, `killsByType`, `armoredBeetleKills`, `bestCombo`, `rampages`, `bites`, `noBiteScore`, `grinds`, `hearts`, `bestStreak`, `levelReached`, `timeSurvived`.

New fields (exact touch-site line refs deferred to the build plan):

- `grindedKills` — incremented in `grindLatchedAfterRoll` when a grind removes a bug.
- `firstRampageAt`, `lastRampageAt` — set in the rampage-activation branch.
- `firstBiteAt` — set in `applyBite`.
- `levelReachedBiteFree`, `levelReachedNoRampage`, `levelReachedNoHeart` — re-appraised every `tick` (max level where the respective abstention holds).
- `comboThresholdsCrossed: number` — count of distinct ×10-tier crossings.
- `comboMaxHoldSec: number` — longest contiguous window where `combo > 0` (recomputed each tick).
- `killsBy60s: number` — frozen at t=60.
- `firstHatchOccurred: boolean`, `eggsCrushedBeforeHatch: number` — from the hatch path and the `eggsac` pre-hatch check.
- `rampageTimestamps: number[]` — capped-ring buffer for `fl-hot60`'s 60s-sliding-window check.

## 7. Economy rethink

**Keep** `meta.points` (cross-team skin currency confirmed). Per-completion reward: 🟡 25/50/100 placeholder; final values **pending the skins lead** (§11).

**Replace v2's §D point-repair with grace tokens.** Every 7-day play-streak accrues one missed-day repair token (max 1 banked). On the day after a missed day, a token can be spent to preserve the streak. This solves the same "broken streak → why bother" churn moment as v2's point-sink, with two advantages:
- Zero currency outflow competing with the skins team's sinks.
- Self-contained — no cross-team spend coordination.

**Keep v2 §C:** streak = consecutive days **played**, not completed. Advances on any `"end"` phase; rename `lastStreakDate` → `lastPlayedDate`.

**Cut from v1 §3.4:** the `badges` array (write-only, nothing renders it).

**Cut from v1 §3.2 pool — redundant with the daily leaderboard:** `e-warmup`, `m-sixfig`, `h-250k`, `e-cobalt`, `m-emerald`, `h-void`.

**Cut from v1 §3.2 pool — pure-volume grinds with no behavior change:** `m-ext500`, `h-genocide`, `m-beetle30`, `e-survive3`, `m-survive5`, `h-survive8`.

## 8. UI rethink

**`#daily-card` (start screen):** three challenge rows, each tagged SPARK / FLOW / STRETCH with its tier color. Per row: tier chip, axis micro-icon, text, progress bar (with units), ✓ state. Footer: `🔥 {streak} day streak · next milestone in {N} days · 🛡 {graceTokens} repair · {points} pts`. No per-row points column — points only in the footer balance.

**Game-over variant (`compact`):** keep v2's nearest-incomplete view, **extend for constraints**: STRETCH challenges whose failure is binary show a `failReason` line, not a bar — e.g. *"No RAMPAGE to LVL 10 — abstention lost at LVL 7/10. One more run?"* The "one more run" loop already strong in v2 is now stronger because the near-miss is on a *playstyle* goal, not the same score goal the leaderboard is grinding for.

**STRETCH completion toast + game-over conflict copy:** when a STRETCH challenge completes during a leaderboard cycle, UI acknowledges the deliberate sacrifice explicitly. Toast prefix for STRETCH: *"You played against the leaderboard today — ✓ {challenge text}."* Game-over line for any STRETCH completed this run: a small badge *"STRETCH cleared — leaderboard score capped by design today."*

**Toast (general):** simplified — `✓ {challenge text}`. No points text per toast (points go to footer balance only).

## 9. Retention mapping (v2 addendum, applied to v3)

| v2 § | v2 item | v3 |
|---|---|---|
| A | Cue (notifications) | **Keep unchanged** |
| B | Achievability floor | **Keep and strengthen** — SPARK tier is explicitly the bad-run-able slot; selection rule: SPARK slot never picks the bottom-3 hardest of its pool |
| C | Streak on play | **Keep** — now the only meta alongside points |
| D | Streak repair | **Replace** point-sink with grace-token system (cross-team decoupled) |
| E | Near-miss game-over | **Keep, upgrade** — show constraint `failReason` for STRETCH; show axis-aware "almost there" copy for FLOW/SPARK |
| F | Metrics | **Keep + extend** — track completion rate per tier (SPARK/FLOW/STRETCH) **and** a daily "did the player play differently today from their leaderboard run?" signal (the actual moat-success metric) |

## 10. What v3 deliberately does NOT own

- **Skin economy.** v3 only feeds `meta.points` to whatever sink the skins team designs. Treat the dailies' points output as opaque currency.
- **Leaderboard features.** v3 explicitly avoids any challenge that overlaps with leaderboard pressure; both teams' features stay complementary.
- **Backend / seeded runs / modifier days / bonus days / weekly meta-challenges.** Still deferred (v2 "Defer" list), unchanged in v3.

## 11. Open items (external coordination)

1. 🟡 **Reward values:** 25/50/100 placeholder vs. 30/60/120 (STRETCH is structurally harder than v1's "hard" — actively fights the leaderboard). **Pending skins lead.**
2. 🟡 **Read surface for skins team:** will the skins team consume only `meta.points`, or also `meta.streak` (for streak-gated cosmetics later)? Affects whether the dailies expose a streak observation API to other team's code.
3. 🟡 **Leaderboard cadence alignment:** confirm leaderboard rotation. v3 assumes daily-reset; if it ever changes, the "no overlap with leaderboard" rule must be re-validated.

## 12. Verification plan

1. `npm run build` + `npm run lint` clean.
2. **Selection determinism + axis-free** script (`npx tsx`): iterate 90 consecutive dates; assert exactly 3 picks/day, one per tier, no same-day axis collisions, no consecutive-day id repeats at any tier.
3. **Manual playtest matrix:**
   - SPARK completes within a single below-average run.
   - FLOW challenges show measurable `phase: "live"` 2 Hz bar updates.
   - STRETCH constraints correctly abort + show `failReason` on breach (e.g. trigger RAMPAGE → `st-norampage10` game-over shows *"abstention lost at LVL 7/10"*).
   - Compound challenges report failure of the specific broken axis only.
   - STRETCH completion toast shows the conflict-copy prefix.
   - Grace-token accrues on 7-day streak, repairs a missed day, caps at 1 banked.
   - Day-rollover (injectable `now`) re-rolls the pool and advances the streak calendar correctly.
4. `@vercel/analytics` events (required per v2 §F): `daily_completed { tier }`, `daily_failed { tier, axis }`, `daily_grace_repair_used`, `daily_session_played_differs_from_leaderboard_run`.

---

## Status

- Pool: complete (14/14/14, axis-tagged, compounds included).
- Architecture (engine instrumentation, storage, events): same as v1 §5/§3.4/§4 with §6 additions.
- Economy: points kept, grace-token repair introduced.
- UI: tier-tags + axis-icons + `failReason` + conflict copy.
- Retention fixes A–F: all preserved or strengthened.
- Pending: reward values and points/streak read-surface with the skins team.

This is an idea plan, not an implementation plan; the build plan will be a separate doc once the open external items (§11) are settled.