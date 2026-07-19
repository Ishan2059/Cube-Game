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
