import { MAX_RUN_EVENTS } from "@/lib/game-rules";
import type { Difficulty, RunEvent } from "@/lib/game-rules";
import { cleanPlayerName, playerNameError } from "@/lib/player-name";

export type Ticket = { runId: string; pid: string; mode: Difficulty; expiresAt: number };
export type PendingRun = Ticket & { events: RunEvent[]; durationMs: number; initials: string; error?: string };
export type SubmitResult = { rank: number; total: number; streak: number; best: number; score: number };
const PREFIX = "crush-pending:";
let identity: Promise<string | null> | null = null;
let active: { ticket: Ticket | null; events: RunEvent[] } | null = null;
let current: PendingRun | null = null;
let flushing: Promise<void> | null = null;
let generation = 0;

export async function post(path: string, data: unknown): Promise<Response> {
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
}
export function ensureSession(): Promise<string | null> {
  if (!identity) identity = (async () => {
    try {
      const res = await post("/api/session", {});
      if (!res.ok) return null;
      const { pid } = await res.json();
      localStorage.setItem("crush-pid-v2", pid);
      return pid as string;
    } catch { return null; }
  })().finally(() => { identity = null; });
  return identity;
}
export async function beginRun(mode: Difficulty) {
  let ticket: Ticket | null = null;
  try {
    if (await ensureSession()) {
      const response = await post("/api/run", { mode });
      if (response.ok) ticket = await response.json();
    }
  } catch { /* Offline runs remain playable, but cannot be ranked. */ }
  active = { ticket, events: [] };
  current = null;
  return !!ticket;
}
export function recordEvent(seconds: number, kind: RunEvent[1]) {
  if (!active?.ticket) return;
  if (active.events.length >= MAX_RUN_EVENTS) { active.ticket = null; return; }
  active.events.push([Math.round(seconds * 1000), kind]);
}
export function finishRun(seconds: number): PendingRun | null {
  current = active?.ticket ? { ...active.ticket, events: active.events, durationMs: Math.round(seconds * 1000), initials: "" } : null;
  active = null;
  if (current) persist(current);
  return current;
}
function persist(run: PendingRun) {
  try { localStorage.setItem(PREFIX + run.runId, JSON.stringify(run)); }
  catch { window.dispatchEvent(new CustomEvent("crush:save-error", { detail: "Storage is full. Keep this page open and retry saving." })); }
}
export function pendingRuns(): PendingRun[] {
  try {
    return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).flatMap(k => {
      try { const run = JSON.parse(localStorage.getItem(k)!); return run?.runId && Array.isArray(run.events) ? [run as PendingRun] : []; }
      catch { return []; }
    });
  } catch { return []; }
}
export function currentRun() { return current; }
export function saveCandidate() {
  return current ?? pendingRuns().find(run => run.expiresAt > Date.now()) ?? null;
}
async function send(run: PendingRun): Promise<SubmitResult | null> {
  const epoch = generation;
  try {
    const response = await post("/api/score", run);
    if (epoch !== generation) return null;
    if (response.ok) {
      const result = await response.json() as SubmitResult;
      localStorage.removeItem(PREFIX + run.runId);
      localStorage.setItem("crush-initials", run.initials);
      window.dispatchEvent(new CustomEvent("crush:score-saved", { detail: { runId: run.runId, result } }));
      return result;
    }
    if ([400, 401, 403, 409, 410].includes(response.status)) {
      const message = await response.json();
      run.error = message.error || "This run could not be saved.";
      persist(run);
      window.dispatchEvent(new CustomEvent("crush:save-error", { detail: run.error }));
    }
  } catch { /* Persisted run will retry on reconnect, page load, or timer. */ }
  return null;
}
export async function saveRun(run: PendingRun, name: string): Promise<SubmitResult | null> {
  if (playerNameError(name)) return null;
  run.initials = cleanPlayerName(name);
  delete run.error;
  persist(run);
  return send(run);
}
export function retryPending(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const run of pendingRuns()) {
      if (run.error || !run.initials) continue;
      if (run.expiresAt <= Date.now()) {
        run.error = "This pending run expired after seven days.";
        persist(run);
        continue;
      }
      // Never reassign a queued run to a new anonymous identity.
      if (!await send(run)) break;
    }
  })().finally(() => { flushing = null; });
  return flushing;
}
export function initScoreRetries() {
  const retry = () => { void retryPending(); };
  const onReset = (event: StorageEvent) => { if (event.key === "crush-reset") location.reload(); };
  window.addEventListener("online", retry);
  window.addEventListener("storage", onReset);
  const timer = setInterval(retry, 60000);
  retry();
  return () => { clearInterval(timer); window.removeEventListener("online", retry); window.removeEventListener("storage", onReset); };
}
export async function resetProgress(): Promise<boolean> {
  try {
    const response = await post("/api/reset", {});
    if (!response.ok) return false;
    generation++;
    active = null;
    current = null;
    for (const k of Object.keys(localStorage)) if (k.startsWith("crush-")) localStorage.removeItem(k);
    localStorage.setItem("crush-reset", String(Date.now()));
    // Full teardown resets engine state, active requests and all menu caches.
    location.reload();
    return true;
  } catch { return false; }
}
