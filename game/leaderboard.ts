// Client-side leaderboard: anonymous player id + initials in localStorage,
// submit/fetch, and DOM rendering into the game-over screen.

type Row = { pid: string; initials: string; score: number; rank: number };
type Board = { top10: Row[]; myRank: number | null; total: number; neighbors: Row[] };
type SubmitResult = { rank: number | null; total: number; streak: number; best: number };

function uuid(): string {
  return (crypto as Crypto).randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2);
}

export function getPid(): string {
  let id = localStorage.getItem("crush-pid");
  if (!id) {
    id = uuid();
    localStorage.setItem("crush-pid", id);
  }
  return id;
}

export function getInitials(): string {
  return localStorage.getItem("crush-initials") || "";
}
export function setInitials(s: string): string {
  const clean = s.replace(/[^A-Za-z0-9_]/g, "").slice(0, 12);
  localStorage.setItem("crush-initials", clean);
  return clean;
}

export async function submitScore(score: number): Promise<SubmitResult | null> {
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pid: getPid(), initials: getInitials() || "player", score }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline / no backend — game still playable
  }
}

export async function fetchBoard(): Promise<Board | null> {
  try {
    const res = await fetch(`/api/leaderboard?pid=${encodeURIComponent(getPid())}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchMe(): Promise<{ streak: number; atRisk: boolean } | null> {
  try {
    const res = await fetch(`/api/me?pid=${encodeURIComponent(getPid())}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function row(r: Row, me: number | null): string {
  const you = r.rank === me ? " lb-you" : "";
  const name = r.initials || "player";
  return `<div class="lb-row${you}"><span class="lb-rank">#${r.rank}</span><span class="lb-name">${name}</span><span class="lb-score">${r.score}</span></div>`;
}

// Renders top 10 + a "your rank" block with neighbors when you're off the top.
export function renderBoard(el: HTMLElement, b: Board | null): void {
  if (!b) {
    el.innerHTML = `<p class="lb-empty">Leaderboard offline</p>`;
    return;
  }
  let html = `<div class="lb-title">TODAY · ${b.total} PLAYERS</div>`;
  html += b.top10.length
    ? b.top10.map((r) => row(r, b.myRank)).join("")
    : `<p class="lb-empty">Be the first today.</p>`;

  const inTop = b.myRank !== null && b.myRank <= b.top10.length;
  if (b.myRank && !inTop) {
    html += `<div class="lb-title">YOU · #${b.myRank} of ${b.total}</div>`;
    html += b.neighbors.map((r) => row(r, b.myRank)).join("");
  }
  el.innerHTML = html;
}
