// Runnable check: `npx tsx lib/leaderboard-core.test.ts`
// No framework — asserts + throws on failure.
import assert from "node:assert";
import {
  computeStreak,
  yesterdayKey,
  sanitizeInitials,
  validateScore,
  MAX_SCORE,
} from "./leaderboard-core";

const TODAY = "2026-07-19";
const YDAY = "2026-07-18";

// dates
assert.equal(yesterdayKey(TODAY), YDAY);
assert.equal(yesterdayKey("2026-01-01"), "2025-12-31"); // year rollover

// streak
assert.equal(computeStreak(null, 0, TODAY), 1, "first play = 1");
assert.equal(computeStreak(undefined, 0, TODAY), 1, "no record = 1");
assert.equal(computeStreak(YDAY, 4, TODAY), 5, "played yesterday = +1");
assert.equal(computeStreak(TODAY, 5, TODAY), 5, "replay today = unchanged");
assert.equal(computeStreak(TODAY, 0, TODAY), 1, "replay today floors at 1");
assert.equal(computeStreak("2026-07-10", 9, TODAY), 1, "gap resets to 1");

// username
assert.equal(sanitizeInitials("abc"), "abc", "case preserved");
assert.equal(sanitizeInitials("cool_guy_99"), "cool_guy_99", "alnum + underscore");
assert.equal(sanitizeInitials("a!b@c#d"), "abcd", "strip punctuation");
assert.equal(sanitizeInitials("abcdefghijklmnop"), "abcdefghijkl", "clamp to 12");
assert.equal(sanitizeInitials(""), "player", "empty fallback");
assert.equal(sanitizeInitials(null), "player");

// score
assert.equal(validateScore(1234), 1234);
assert.equal(validateScore(0), 0);
assert.equal(validateScore(MAX_SCORE), MAX_SCORE);
assert.equal(validateScore(MAX_SCORE + 1), null, "over cap rejected");
assert.equal(validateScore(-5), null, "negative rejected");
assert.equal(validateScore(1.5), null, "non-integer rejected");
assert.equal(validateScore("abc"), null, "NaN rejected");

console.log("ok — all leaderboard-core assertions passed");
