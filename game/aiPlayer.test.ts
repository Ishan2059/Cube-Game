// Runnable check: `npx tsx game/aiPlayer.test.ts`
// No framework — asserts + throws on failure.
import assert from "node:assert";
import { describeState, parseDirection, buildRequestBody, parseDecision } from "./aiPlayer";

// direction parsing
assert.deepEqual(parseDirection("up"), [0, -1]);
assert.deepEqual(parseDirection("down"), [0, 1]);
assert.deepEqual(parseDirection("left"), [-1, 0]);
assert.deepEqual(parseDirection("right"), [1, 0]);
assert.equal(parseDirection("stay"), null, "stay = no move");
assert.equal(parseDirection("sideways"), null, "unknown direction = no move");
assert.equal(parseDirection(undefined), null);
assert.equal(parseDirection(3), null, "non-string input = no move");

// state description
const text = describeState({
  lives: 2,
  combo: 3,
  dazed: false,
  slowed: true,
  poisoned: false,
  stalled: false,
  nearby: [{ type: "locust", dx: -1, dz: 2 }],
  open: ["down", "right"],
});
assert.match(text, /Lives left: 2/);
assert.match(text, /Combo streak: 3/);
assert.match(text, /webbed\/slowed/);
assert.match(text, /locust at \(-1, \+2\)/);

const empty = describeState({
  lives: 3,
  combo: 0,
  dazed: false,
  slowed: false,
  poisoned: false,
  stalled: false,
  nearby: [],
  open: ["up", "down", "left", "right"],
});
assert.match(empty, /none nearby/);
assert.match(empty, /Active debuffs: none\b/);

// the request body is what actually keeps Jev off blocked tiles: a
// direction missing here can never appear in the API's `criteria`, and a
// direction Jev was never offered can never come back as its answer —
// see route.ts's `criteria` build.
const boxedIn = buildRequestBody({
  lives: 1,
  combo: 0,
  dazed: false,
  slowed: false,
  poisoned: false,
  stalled: false,
  nearby: [],
  open: ["right"],
});
assert.deepEqual(boxedIn.open, ["right"], "blocked directions never reach the API call");

// decision parsing — what feeds both the move and the HUD readout
const decision = parseDecision({
  direction: "right",
  confidence: 0.874,
  probabilities: { right: 0.874, stay: 0.126 },
  usage: { input_tokens: 42, output_tokens: 0 },
});
assert.deepEqual(decision, {
  direction: "right",
  move: [1, 0],
  confidence: 0.874,
  inputTokens: 42,
  probabilities: { right: 0.874, stay: 0.126 },
});

const stayDecision = parseDecision({ direction: "stay", confidence: null, usage: {} });
assert.equal(stayDecision?.move, null, "stay never produces a move vector");
assert.equal(stayDecision?.inputTokens, 0, "missing usage falls back to 0");

assert.equal(parseDecision(null), null);
assert.equal(parseDecision({ confidence: 0.5 }), null, "missing direction = unparseable");

console.log("aiPlayer: ok");
