import { ensureSession, post } from "./run-client";
import { cleanPlayerName, displayPlayerName, playerNameError } from "@/lib/player-name";
// Client-side leaderboard: anonymous player id + initials in localStorage,
// submit/fetch, and DOM rendering into the game-over screen.
import { isValidPid, buildShareUrl } from "@/lib/leaderboard-core";
import { cardToFile, downloadCard } from "./share-card";

// The player's shareable challenge link (encoded into the card's QR + footer).
export function challengeUrl(): string {
  return buildShareUrl(location.origin, getPid());
}

type Row = { pid: string; initials: string; score: number; rank: number };
type Board = { mode: string; top10: Row[]; myRank: number | null; total: number; neighbors: Row[]; me: Row | null };
export function getPid(): string {
  return localStorage.getItem("crush-pid-v2") || "";
}

export function getInitials(): string {
  const name = localStorage.getItem("crush-initials") || "";
  return playerNameError(name) ? "" : name;
}
export function setInitials(s: string): string {
  if (playerNameError(s)) return "";
  const clean = cleanPlayerName(s);
  localStorage.setItem("crush-initials", clean);
  return clean;
}

// Update the local name only after the authenticated server write succeeds.
export async function renameInitials(newName: string): Promise<{ name: string; synced: boolean } | null> {
  if (playerNameError(newName)) return null;
  const clean = cleanPlayerName(newName);
  if (!clean) return null;
  try {
    if (!await ensureSession()) return null;
    const res = await fetch("/api/rename", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initials: clean }),
    });
    if (!res.ok) return null;
    setInitials(clean);
    return { name: clean, synced: true };
  } catch {
    return null;
  }
}

export async function fetchBoard(mode = "normal"): Promise<Board | null> {
  try {
    const res = await fetch(`/api/leaderboard?mode=${encodeURIComponent(mode)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// If arrived via ?ref=<pid>, count the referral once (per referrer, deduped in
// localStorage) so we can measure share -> play conversion. Best-effort.
export function trackRef(): void {
  try {
    const ref = new URLSearchParams(location.search).get("ref");
    if (!ref || !isValidPid(ref) || ref === getPid()) return;
    if (localStorage.getItem("crush-ref")) return; // already attributed
    localStorage.setItem("crush-ref", ref);
    void ensureSession().then(() => post("/api/ref", { pid: ref })).catch(() => {});
  } catch {
    // no-op — attribution is never allowed to break load
  }
}

export async function fetchMe(): Promise<{ streak: number; atRisk: boolean } | null> {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Save the card straight to the user's device as a PNG. Explicit "download",
// separate from the share sheet.
export async function saveCard(canvas: HTMLCanvasElement): Promise<"saved" | "failed"> {
  const file = await cardToFile(canvas);
  if (!file) return "failed";
  downloadCard(file);
  return "saved";
}

// Copy the rendered card PNG straight to the clipboard (paste into chats,
// docs, socials). Needs the async Clipboard API + ClipboardItem (Chrome/Edge/
// Safari; Firefox behind a flag).
export async function copyCardImage(
  canvas: HTMLCanvasElement,
): Promise<"copied" | "unsupported" | "failed"> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return "unsupported";
  try {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return "failed";
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  } catch {
    return "failed";
  }
}

function row(r: Row, me: number | null): string {
  const you = r.rank === me ? " lb-you" : "";
  const name = displayPlayerName(r.initials);
  return `<div class="lb-row${you}"><span class="lb-rank">#${r.rank}</span><span class="lb-name">${name}</span><span class="lb-score">${r.score}</span></div>`;
}

// Renders top 10 + a "your rank" block with neighbors when you're off the top.
export function renderBoard(el: HTMLElement, b: Board | null): void {
  if (!b) {
    el.innerHTML = `<p class="lb-empty">Leaderboard offline</p>`;
    return;
  }
  const me = b.me ?? b.neighbors.find(r => r.rank === b.myRank) ?? b.top10.find(r => r.rank === b.myRank);
  let html = '<section class="lb-position" aria-label="Your leaderboard position"><div class="lb-title">YOUR POSITION</div>';
  html += me
    ? '<div class="lb-position-stats"><div><span>RANK</span><strong>#' + me.rank + ' <small>of ' + b.total + '</small></strong></div><div><span>BEST SCORE</span><strong>' + me.score.toLocaleString() + '</strong></div></div>'
    : '<p class="lb-empty">Not ranked yet. Finish a game and save your score to join.</p>';
  const label = b.mode === "legacy" ? "HISTORICAL (MIXED MODES)" : b.mode === "casual" ? "CASUAL · ALL TIME" : "NORMAL · ALL TIME";
  html += '</section><div class="lb-title">TOP 10 · ' + label + ' · ' + b.total + ' PLAYERS</div>';
  html += b.top10.length ? b.top10.slice(0, 10).map(r => row(r, b.myRank)).join('') : '<p class="lb-empty">Be the first to post a score.</p>';
  if (b.myRank !== null && b.myRank > 10) {
    html += '<div class="lb-title">AROUND YOUR POSITION</div>';
    html += b.neighbors.map(r => row(r, b.myRank)).join('');
  }
  el.innerHTML = html;
}
