/* Turns a compact snapshot of the live game into a Jev "choice" decision.
 * Jev (TypeSafe's System One model) returns a typed pick, not text — no
 * parsing free-form output, just read `direction` off the JSON reply.
 * The actual API key lives server-side only, see app/api/ai-move/route.ts.
 */

export interface ParasiteSnapshot {
  type: string;
  dx: number; // relative to cube, grid tiles (+x = east, +z = south)
  dz: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface AiSnapshot {
  lives: number;
  combo: number;
  dazed: boolean;
  slowed: boolean;
  poisoned: boolean;
  stalled: boolean;
  nearby: ParasiteSnapshot[]; // nearest few threats, closest first
  // Directions not blocked by a rock/pit right now — see
  // engine.ts's openDirectionsForAi(). Jev is never offered a blocked
  // direction as an option, so it can't walk the cube into a wall.
  open: Direction[];
}

const MOVES: Record<string, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

export function describeState(s: AiSnapshot): string {
  const threats = s.nearby.length
    ? s.nearby
        .map(
          (p) =>
            `${p.type} at (${p.dx >= 0 ? "+" : ""}${p.dx}, ${p.dz >= 0 ? "+" : ""}${p.dz})`,
        )
        .join("; ")
    : "none nearby";
  const debuffs =
    [
      s.dazed && "controls inverted",
      s.slowed && "webbed/slowed",
      s.poisoned && "poisoned",
      s.stalled && "stuck in slime",
    ]
      .filter(Boolean)
      .join(", ") || "none";
  return (
    `Rolling-cube survival game. Cube is at relative origin (0,0); ` +
    `+x = east/right, +z = south/down. Lives left: ${s.lives}. ` +
    `Combo streak: ${s.combo}. Active debuffs: ${debuffs}. ` +
    `Nearby parasites, relative to cube: ${threats}. ` +
    `Choose the direction that avoids the closest threats and, when safe, ` +
    `moves toward one to crush it by landing on its tile.`
  );
}

export function parseDirection(dir: unknown): [number, number] | null {
  return typeof dir === "string" ? (MOVES[dir] ?? null) : null;
}

/** What actually goes over the wire — the `open` list is what keeps Jev
 *  from ever being offered a rock/pit as a legal move (see route.ts,
 *  which builds its `criteria` from exactly this list). */
export function buildRequestBody(snapshot: AiSnapshot) {
  return { state: describeState(snapshot), open: snapshot.open };
}

/** One resolved decision, kept around for display (the HUD's AI readout)
 *  as well as driving the move — see engine.ts. */
export interface AiDecision {
  direction: string; // raw answer, e.g. "up" or "stay"
  move: [number, number] | null; // null for "stay"/unrecognized
  confidence: number | null;
  inputTokens: number;
  // every option Jev was offered this turn, with its probability —
  // the "stay" plus whichever directions weren't blocked by a rock/pit.
  probabilities: Record<string, number> | null;
}

export function parseDecision(data: unknown): AiDecision | null {
  const d = data as
    | {
        direction?: unknown;
        confidence?: unknown;
        probabilities?: unknown;
        usage?: { input_tokens?: unknown };
      }
    | null
    | undefined;
  if (typeof d?.direction !== "string") return null;
  return {
    direction: d.direction,
    move: parseDirection(d.direction),
    confidence: typeof d.confidence === "number" ? d.confidence : null,
    inputTokens: typeof d.usage?.input_tokens === "number" ? d.usage.input_tokens : 0,
    probabilities:
      d.probabilities && typeof d.probabilities === "object"
        ? (d.probabilities as Record<string, number>)
        : null,
  };
}

/** Fire one decision request. Resolves null on any network/HTTP failure or
 *  an unparseable reply — callers just skip the move that tick. */
export async function requestAiMove(
  snapshot: AiSnapshot,
): Promise<AiDecision | null> {
  const res = await fetch("/api/ai-move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRequestBody(snapshot)),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return parseDecision(data);
}
