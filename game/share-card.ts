// Client-rendered shareable score card (canvas). Drawn once at game-over, shown
// as a preview, and shared as a PNG file. Square 1080 for social/story surfaces.
// ponytail: separate from the server opengraph-image card — different runtime
// (canvas vs satori) and consumer (in-app share vs crawler unfurl). Unify only
// if the two visibly drift.

export const CARD_SIZE = 1080;

export type CardData = {
  score: number;
  streak: number;
  initials: string;
  kills: number;
  maxCombo: number;
  level: number; // 1-based
  rank: number | null; // daily rank, null if unknown (offline)
  total: number; // players on today's board
  url: string; // challenge link, encoded into the QR + footer
};

// Coarse rank tier by level reached — an identity badge people share.
function tierFor(level: number): string {
  if (level >= 9) return "APEX";
  if (level >= 7) return "RAMPAGER";
  if (level >= 5) return "VETERAN";
  if (level >= 3) return "SCRAPPER";
  return "SPROUT";
}

// "TOP 4%" style percentile from rank/total. Null when we can't compute it.
function percentile(rank: number | null, total: number): number | null {
  if (!rank || total <= 0) return null;
  return Math.max(1, Math.round((rank / total) * 100));
}

// Host shown in the footer, e.g. "crush.game/c/…" trimmed to the domain.
function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Draws the card into an existing canvas (sized to CARD_SIZE internally).
export function renderCard(canvas: HTMLCanvasElement, d: CardData): void {
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;
  const c = canvas.getContext("2d");
  if (!c) return;
  const S = CARD_SIZE;

  const cx = S / 2;
  const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

  // background: deep radial so the center (score) glows out of the dark
  const bg = c.createRadialGradient(cx, 470, 60, cx, 470, 820);
  bg.addColorStop(0, "#1e2b12");
  bg.addColorStop(1, "#0a0c08");
  c.fillStyle = bg;
  c.fillRect(0, 0, S, S);

  drawDotGrid(c, S);

  // double frame: soft outer + crisp inner hairline
  c.strokeStyle = "rgba(143,191,106,0.10)";
  c.lineWidth = 2;
  roundRect(c, 36, 36, S - 72, S - 72, 46);
  c.stroke();
  c.strokeStyle = "rgba(143,191,106,0.34)";
  c.lineWidth = 3;
  roundRect(c, 52, 52, S - 104, S - 104, 38);
  c.stroke();

  c.textAlign = "center";

  // brand lockup: cube mark + wordmark
  drawCube(c, cx - 108, 96, 52);
  c.fillStyle = "#8fbf6a";
  c.font = `800 42px ${FONT}`;
  c.textBaseline = "middle";
  c.fillText(spaced("CRUSH"), cx + 36, 122);
  c.textBaseline = "alphabetic";

  // scarcity kicker: daily + date
  c.fillStyle = "#6f746a";
  c.font = `700 23px ${FONT}`;
  c.fillText(spaced(`DAILY CHALLENGE · ${dateStamp()}`), cx, 182);

  // player name + rank tier badge
  c.fillStyle = "#d7d7cc";
  c.font = `700 40px ${FONT}`;
  c.fillText(spaced(clip((d.initials || "player").toUpperCase(), 12)), cx, 258);
  drawTierBadge(c, cx, 306, tierFor(d.level), FONT);

  // score — hero, with a soft green glow
  c.save();
  c.shadowColor = "rgba(163,217,119,0.45)";
  c.shadowBlur = 60;
  c.fillStyle = "#a3d977";
  c.font = `900 200px ${FONT}`;
  c.fillText(d.score.toLocaleString(), cx, 500);
  c.restore();

  c.fillStyle = "#8d8d82";
  c.font = `700 30px ${FONT}`;
  c.fillText(spaced("POINTS"), cx, 556);

  // social proof: percentile + rank
  const pct = percentile(d.rank, d.total);
  if (pct !== null && d.rank) {
    c.fillStyle = "#e0b64e";
    c.font = `800 34px ${FONT}`;
    c.fillText(`🏆 TOP ${pct}%  ·  #${d.rank.toLocaleString()} OF ${d.total.toLocaleString()}`, cx, 616);
  }

  // point breakdown: three stat columns
  const col = 230;
  drawStat(c, cx - col, 712, d.kills.toLocaleString(), "PARASITES", FONT);
  drawStat(c, cx, 712, `×${Math.max(1, d.maxCombo)}`, "BEST COMBO", FONT);
  drawStat(c, cx + col, 712, String(d.level), "LEVEL", FONT);

  // hairline divider
  c.strokeStyle = "rgba(255,255,255,0.08)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx - 300, 788);
  c.lineTo(cx + 300, 788);
  c.stroke();

  // streak — the focal brag
  drawStreakPill(c, cx, 848, d.streak, FONT);

  // footer: dare + host — the pull back to the platform
  c.fillStyle = "#e0b64e";
  c.font = `800 42px ${FONT}`;
  c.fillText("CAN YOU BEAT THIS?", cx, 948);
  const host = hostLabel(d.url);
  c.fillStyle = "#8d8d82";
  c.font = `700 26px ${FONT}`;
  c.fillText(spaced(host ? `${host.toUpperCase()}  ·  PLAY NOW` : "PLAY NOW"), cx, 998);
}

// Small tier badge pill (identity brag).
function drawTierBadge(c: CanvasRenderingContext2D, cx: number, cy: number, tier: string, font: string) {
  const label = spaced(tier);
  c.font = `800 26px ${font}`;
  const w = c.measureText(label).width + 56;
  const h = 46;
  c.fillStyle = "rgba(143,191,106,0.14)";
  c.strokeStyle = "rgba(143,191,106,0.55)";
  c.lineWidth = 2;
  roundRect(c, cx - w / 2, cy - h / 2, w, h, h / 2);
  c.fill();
  c.stroke();
  c.fillStyle = "#a3d977";
  c.textBaseline = "middle";
  c.fillText(label, cx, cy + 1);
  c.textBaseline = "alphabetic";
}

// One point-breakdown stat: big value over a small muted label.
function drawStat(c: CanvasRenderingContext2D, x: number, y: number, value: string, label: string, font: string) {
  c.textAlign = "center";
  c.fillStyle = "#e8e8e0";
  c.font = `800 56px ${font}`;
  c.fillText(value, x, y);
  c.fillStyle = "#7f8478";
  c.font = `700 22px ${font}`;
  c.fillText(label, x, y + 40);
}

// Faint dot grid texture across the whole card.
function drawDotGrid(c: CanvasRenderingContext2D, S: number) {
  c.fillStyle = "rgba(255,255,255,0.028)";
  const step = 46;
  for (let x = step; x < S; x += step) {
    for (let y = step; y < S; y += step) {
      c.beginPath();
      c.arc(x, y, 2, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// Rounded cube mark echoing the game's rolling cube (top face highlight).
function drawCube(c: CanvasRenderingContext2D, x: number, cy: number, size: number) {
  const y = cy - size / 2;
  const g = c.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, "#a3d977");
  g.addColorStop(1, "#6f9e46");
  c.fillStyle = g;
  roundRect(c, x, y, size, size, 16);
  c.fill();
  // specular highlight
  c.fillStyle = "rgba(255,255,255,0.28)";
  roundRect(c, x + 12, y + 10, size - 24, size * 0.32, 10);
  c.fill();
}

function dateStamp(): string {
  return new Date()
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

// Prominent streak badge: gold pill with fire + big count. This is the retention
// hook, so it's the loudest element after the score.
function drawStreakPill(c: CanvasRenderingContext2D, cx: number, cy: number, streak: number, font: string) {
  const label = streak > 0 ? `${streak} DAY STREAK` : "NEW STREAK";
  c.font = `800 54px ${font}`;
  const textW = c.measureText(label).width;
  const w = textW + 190; // room for fire emoji + padding
  const h = 108;
  const x = cx - w / 2;
  const y = cy - h / 2;

  // soft gold glow under the pill
  c.save();
  c.shadowColor = "rgba(224,182,78,0.5)";
  c.shadowBlur = 46;
  const g = c.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "#f0c85e");
  g.addColorStop(1, "#c99a2e");
  c.fillStyle = g;
  roundRect(c, x, y, w, h, h / 2);
  c.fill();
  c.restore();

  // inner top sheen
  c.fillStyle = "rgba(255,255,255,0.18)";
  roundRect(c, x + 14, y + 10, w - 28, h * 0.32, h / 4);
  c.fill();

  c.textAlign = "left";
  c.textBaseline = "middle";
  c.font = "56px 'Segoe UI', system-ui, sans-serif";
  c.fillText("🔥", x + 40, cy + 2);
  c.fillStyle = "#241a06";
  c.font = `800 54px ${font}`;
  c.fillText(label, x + 120, cy + 2);
  c.textAlign = "center";
  c.textBaseline = "alphabetic"; // restore
}

function spaced(s: string): string {
  return s.split("").join(" "); // thin-space letterspacing
}
function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

// Canvas -> PNG File for navigator.share({ files }).
export function cardToFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], "crush-score.png", { type: "image/png" }) : null);
    }, "image/png");
  });
}

// Fallback when no share sheet: trigger a download of the card.
export function downloadCard(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
