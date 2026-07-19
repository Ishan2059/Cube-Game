// Runnable check: `npx tsx lib/leaderboard-core.test.ts`
// No framework — asserts + throws on failure.
import assert from "node:assert";
import {
  computeStreak,
  yesterdayKey,
  sanitizeInitials,
  validateScore,
  isValidPid,
  buildShareText,
  buildShareUrl,
  buildSocialLinks,
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

// pid validation (trust boundary — reused by /api/score + /c/[pid])
assert.equal(isValidPid("a1b2c3d4"), true, "8-char alnum ok");
assert.equal(isValidPid("550e8400-e29b-41d4-a716-446655440000"), true, "uuid ok");
assert.equal(isValidPid("short"), false, "under 8 rejected");
assert.equal(isValidPid("bad pid!"), false, "space/punct rejected");
assert.equal(isValidPid(""), false);
assert.equal(isValidPid(null), false);
assert.equal(isValidPid("x".repeat(65)), false, "over 64 rejected");

// share text
assert.equal(buildShareText(1234, 5), "I hit 1234 in Crush 🔥5. Beat me:");
assert.equal(buildShareText(1234, 0), "I hit 1234 in Crush. Beat me:", "no streak = no fire");

// share url
assert.equal(buildShareUrl("https://crush.app", "abc123def"), "https://crush.app/c/abc123def");
assert.equal(buildShareUrl("https://crush.app/", "abc123def"), "https://crush.app/c/abc123def", "trailing slash trimmed");

// social links — text/url encoded, all 5 networks present
{
  const L = buildSocialLinks("I hit 500 in Crush 🔥3. Beat me:", "https://c.app/c/abc");
  assert.ok(L.x.startsWith("https://twitter.com/intent/tweet?"), "x intent");
  assert.ok(L.x.includes("url=https%3A%2F%2Fc.app%2Fc%2Fabc"), "x url encoded");
  assert.ok(L.whatsapp.startsWith("https://wa.me/?text="), "whatsapp intent");
  assert.ok(L.whatsapp.includes("Crush%20%F0%9F%94%A53"), "whatsapp text+emoji encoded");
  assert.ok(L.telegram.startsWith("https://t.me/share/url?"), "telegram intent");
  assert.ok(L.facebook.includes("u=https%3A%2F%2Fc.app"), "facebook url");
  assert.ok(L.reddit.includes("title="), "reddit title");
}

console.log("ok — all leaderboard-core assertions passed");
