// Pure leaderboard logic — no Redis, no I/O. Unit-testable.

export const MAX_SCORE = 100_000;

// UTC day key so the daily board resets at the same instant for everyone
// and doesn't drift with server timezone.
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function yesterdayKey(today: string): string {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKey(d);
}

// New streak given the player's last-played day + previous streak.
//   played today already -> unchanged (min 1)
//   played yesterday     -> +1
//   gap / first play     -> 1
export function computeStreak(
  lastPlayed: string | null | undefined,
  prevStreak: number,
  today: string,
): number {
  if (lastPlayed === today) return Math.max(prevStreak, 1);
  if (lastPlayed === yesterdayKey(today)) return prevStreak + 1;
  return 1;
}

// Anonymous player id shape (localStorage crypto.randomUUID or fallback).
// Same rule the /api/score route enforces — reuse at every trust boundary.
export function isValidPid(pid: unknown): pid is string {
  return typeof pid === "string" && /^[a-z0-9-]{8,64}$/i.test(pid);
}

// Social share copy. Streak only shown when the player has one to brag about.
export function buildShareText(score: number, streak: number): string {
  const fire = streak > 0 ? ` 🔥${streak}` : "";
  return `I hit ${score} in Crush${fire}. Beat me:`;
}

// Share/challenge landing URL for a given player id.
export function buildShareUrl(origin: string, pid: string): string {
  return `${origin.replace(/\/$/, "")}/c/${pid}`;
}

export type SocialNet = "x" | "whatsapp" | "telegram" | "facebook" | "reddit";

// Intent URLs per network. They carry text + the challenge link; the link
// unfurls to the OG card (image share is native/save-image only).
export function buildSocialLinks(text: string, url: string): Record<SocialNet, string> {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  const tu = encodeURIComponent(`${text} ${url}`);
  return {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    whatsapp: `https://wa.me/?text=${tu}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    reddit: `https://www.reddit.com/submit?url=${u}&title=${t}`,
  };
}

export function sanitizeInitials(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 12) || "player";
}

// Returns clamped score, or null if invalid (reject, don't clamp silently down
// from garbage like NaN / negative / non-integer).
export function validateScore(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_SCORE) return null;
  return n;
}
