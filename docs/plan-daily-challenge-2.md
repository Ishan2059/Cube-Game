# Plan Addendum: Daily Challenges as a Retention Engine

**Companion to** `plan-daily-challenge.md`. That doc is a sound *engineering* plan and a weak *retention* plan — it nails the routine + reward, half-nails investment, and misses the return cue entirely. This doc lists the retention-driven changes to fold in before build.

## Retention model (why any of this matters)

Daily challenges retain through one mechanism: **a recurring reason to return that expires**. That only works if the habit loop is complete:

| Habit part | What it is | Base plan status |
|---|---|---|
| **Cue** | trigger to return | ❌ missing — player must remember |
| **Routine** | the daily play | ✅ the challenges |
| **Reward** | payoff | ⚠️ points, but no sink = not felt |
| **Investment** | cost of quitting | ⚠️ streak, but fragile & mis-gated |

Four forces the design must maximize: **Anticipation** (want to see today's), **Loss/scarcity** (gone at midnight), **Closure** (I finished today), **Investment** (streak too painful to break). And it must serve the funnel stage-by-stage: **Day1→Day2** (guaranteed early win), **Day2→Day7** (streak + variety), **Day7+** (meta-progression).

Core rule: retention protects the *marginal/wobbling* player, not the whale. Calibrate the floor to the churner, the ceiling to the fan.

---

## Changes (priority order)

### A. Add a Cue — new §10 "Return trigger" *(must)*

Base plan has zero return mechanism. Without it the system retains only players who already come back on their own.

- `Notification` API opt-in, prompted **after first streak hit (day 2)**, not day 1 — earn trust before asking.
- On next-day eligibility, fire a local reminder: `🔥 {streak}-day streak — today's challenges are live.`
- Browser-local only (no backend) — fits the local-only constraint.
- Ceiling: browser notifications only fire while/after the tab has been opened; true push needs a service worker + backend (out of scope). Note as upgrade path.

### B. Fix the achievability floor — edit §3.2 easy tier + §4.1 selection *(must)*

Easy tier calibrated to "~1 average run (~100k)" excludes the exact player retention targets. A first-timer who clears zero on day one never returns.

- Retarget **easy** to a *bad* run: e.g. `Score 15,000`, `Reach LVL 5`, `Survive 90s`, `Crush 100 parasites today`, `×6 combo`.
- Selection rule: **guarantee the easy slot is always cleanable in one sub-average run.** Never let the seed hand a new player 3 unreachable goals.
- Keep medium/hard where they are — that's the fan's ceiling.

### C. Streak on *play*, reward on *completion* — rewrite §4.4 + §3.4 schema *(must)*

Current streak advances only on completion → the returning-but-weak player stays at streak 0 → churn-risk player gets punished for showing up.

- Streak = consecutive days **played**; advance on any `"end"` phase.
- Rename `lastStreakDate` → `lastPlayedDate`.
- Points still gate on **completion**. Two decoupled counters: showing up keeps the streak, winning earns points.

Revised §4.4 logic:
```
on "end" (any run):
  if lastPlayedDate == yesterday   -> streak++
  else if lastPlayedDate == today  -> unchanged
  else                             -> streak = 1
  lastPlayedDate = today
```

### D. Give points a use NOW — streak repair — edit Scope line + §4.4 *(must)*

"Points banked now, spent later" = invisible reward = zero scarcity power, and the skin shop is out of scope. Make the **first sink be streak repair** — no shop UI, reuses `points`, ships now.

- Missed exactly one day (`lastPlayedDate == day-before-yesterday`) → on next load offer **"Repair streak — 100 pts."**
- Accepting continues the streak as if unbroken.
- Turns the #1 churn moment (broken streak → "why bother") into a recoverable one, and makes points immediately valued (which is what gives every reward its scarcity).

### E. Near-miss on game-over — edit §6 game-over variant *(should)*

Currently shows "challenges whose progress changed." Flip to **nearest-incomplete challenge + its bar**:
> `Score 42,000 / 50,000 — one more run.`

Powers the within-session "one more run" loop for free. Loss-aversion + visible achievability = the replay pull. The player who quits at 90% churns; the one who sees "so close" replays.

### F. Metrics are core, not optional — rewrite §9 bullet 1 *(should)*

Retention you can't measure you can't tune. Promote `@vercel/analytics` from "optional aside" to required. Log:
- **D1 / D7 return rate**
- **streak-length distribution**
- **completion rate per tier**

Every calibration in A–E is a guess without this.

---

## Defer (note in §9 follow-ups, don't build yet)

- **Anticipation / variable reward:** occasional "bonus day" (2× points or a rare challenge). Variable reward retains hardest, but ship the core loop first.
- **Streak milestones:** day 7 / 30 bonus with a visible "next milestone in N days" forward-pull.
- **Comeback bonus / decayed difficulty** for lapsed returners.
- **Weekly meta-challenge** ("complete 5 dailies this week") for the longer arc.

## Cut from the base plan (retention says noise now)

- `badges` array (§3.4) — write-only, nothing renders it, no retention function. Drop until something reads it.
- "Points spent later / skin shop" framing — replace with the repair sink (D) as the real first use; skin shop stays a later plan.

---

## Priority summary

**A → B → C → D** are the retention spine — skip any one and the mechanic leaks:
- **A** without it → no cue, no daily habit forms.
- **B** without it → new/weak players clear nothing, bounce day one.
- **C** without it → returning players punished, streak (the strongest primitive) mis-fires.
- **D** without it → reward is invisible, expiry has no bite.

**E, F** are cheap multipliers on top.
