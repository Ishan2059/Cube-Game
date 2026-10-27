import { ENEMY_ARRIVAL, INITIAL_SWARM } from "./exploration-rules";
import { LEVELS } from "../game/levels";
import { COMBO_WINDOW, killPoints, MAX_RUN_EVENTS, MAX_RUN_SECONDS, PARASITES } from "./game-rules";
import type { Difficulty } from "./game-rules";

// These are plausibility checks, not a replay of movement/collisions. The server
// computes the score, but a determined modified client can forge plausible events.
export function scoreRun(events: unknown, durationMs: unknown, wallMs: number, mode: Difficulty): number | null {
  if (!Number.isSafeInteger(durationMs) || Number(durationMs) < 0 ||
      Number(durationMs) > MAX_RUN_SECONDS * 1000 || Number(durationMs) > wallMs + 1000 ||
      !Array.isArray(events) || events.length > MAX_RUN_EVENTS) return null;
  let score = 0;
  let level = 0;
  let combo = 0;
  let last = 0;
  let lastKill = -Infinity;
  let kills = 0;
  for (const event of events) {
    if (!Array.isArray(event) || event.length !== 2) return null;
    const [time, type] = event;
    if (!Number.isSafeInteger(time) || time < last || time > Number(durationMs) || typeof type !== "string") return null;
    last = time;
    if (type === "break") { combo = 0; continue; }
    if (!Object.hasOwn(PARASITES, type)) return null;
    const parasite = type as keyof typeof PARASITES;
    // Enemies spawned before a level transition can still be alive afterward.
    if (time / 1000 < ENEMY_ARRIVAL[parasite] && !LEVELS.slice(0, level + 1).some(l => l.weights[parasite])) return null;
    // Spawn interval bottoms at 0.45 * 0.7 sec; egg sacs can add three bugs.
    // Use a conservative ceiling so valid frame timing and multi-kills fit.
    const minimumSpawnMs = 0.45 * 0.7 * (mode === "casual" ? 1.18 : 1) * 1000;
    const brood = level >= 8 || time / 1000 >= ENEMY_ARRIVAL.eggsac ? 4 : 1;
    if (++kills > ((time < 250 ? 1 : INITIAL_SWARM) + Math.floor(time / minimumSpawnMs)) * brood) return null;
    if (time - lastKill > COMBO_WINDOW * 1000) combo = 0;
    score += killPoints(parasite, ++combo);
    lastKill = time;
    while (LEVELS[level + 1] && score >= LEVELS[level + 1].at) level++;
  }
  return score;
}
