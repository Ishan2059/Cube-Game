// Client-side leaderboard: anonymous player id + initials in localStorage,
// submit/fetch, and DOM rendering into the game-over screen.
import { isValidPid, buildShareUrl } from "@/lib/leaderboard-core";
import { cardToFile, downloadCard } from "./share-card";

// The player's shareable challenge link (encoded into the card's QR + footer).
export function challengeUrl(): string {
  return buildShareUrl(location.origin, getPid());
}

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

// If arrived via ?ref=<pid>, count the referral once (per referrer, deduped in
// localStorage) so we can measure share -> play conversion. Best-effort.
export function trackRef(): void {
  try {
    const ref = new URLSearchParams(location.search).get("ref");
    if (!ref || !isValidPid(ref) || ref === getPid()) return;
    if (localStorage.getItem("crush-ref")) return; // already attributed
    localStorage.setItem("crush-ref", ref);
    void fetch("/api/ref", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pid: ref }),
    });
  } catch {
    // no-op — attribution is never allowed to break load
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
