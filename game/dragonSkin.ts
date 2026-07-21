/* ================= DRAGON skin artwork =================
 * Draws one imperial-style dragon across the cube's unwrapped net (see
 * cubeNet.ts), rather than a tile repeated on all six faces. The body enters
 * and leaves cells mid-stroke, so it continues over the edges: rotating the
 * cube reveals successive stretches of the same creature — head on top, coils
 * around the sides, tail curling under.
 *
 * Grayscale on purpose, exactly like Rocky and Rubix: the material's colour is
 * the level tint, and a grayscale map multiplies through it, so the dragon
 * picks up each level's palette instead of fighting it. Values are pushed hard
 * (near-white body on a near-black ground) so it reads as gilt relief.
 *
 * Everything is authored in y-up atlas pixels — the canvas is flipped once up
 * front so this matches UV space directly.
 */

const COLS = 4;
const ROWS = 3;

/* The path runs head -> tail in atlas pixels for a cell size of 1 (scaled by
 * the real cell size at draw time). x deliberately runs past the atlas width:
 * the band is periodic, so the body laps the cube roughly twice and is drawn
 * at several horizontal offsets, clipped per cell.
 *
 * Two crossings are load-bearing and must stay inside column 0 (the +Z face),
 * the only column with cells above and below it in the net:
 *   - the neck rising through the band's top edge onto the top face
 *   - the tail dropping through its bottom edge onto the bottom face
 */
const SPINE: [number, number][] = [
  // Head sits mid-cell and faces up-left, so the snout, horns and whiskers all
  // stay clear of the top face's other three edges — those neighbours aren't
  // adjacent in the net, so anything crossing them would simply be cut off.
  [0.5, 2.4], // head, on the top face
  [0.64, 2.26],
  [0.72, 2.08],
  [0.75, 1.95], // crosses onto the front face
  [0.84, 1.72],
  [1.13, 1.48],
  [1.56, 1.33],
  [2.03, 1.48],
  [2.5, 1.68],
  [2.97, 1.64],
  [3.44, 1.37],
  [3.91, 1.23],
  [4.38, 1.33],
  [4.84, 1.56],
  [5.31, 1.72],
  [5.78, 1.64],
  [6.25, 1.41],
  [6.72, 1.27],
  [7.19, 1.35],
  [7.66, 1.54],
  [8.11, 1.64],
  [8.36, 1.48],
  [8.46, 1.17],
  [8.5, 0.96], // crosses onto the bottom face
  [8.47, 0.78],
  [8.32, 0.66],
  [8.18, 0.72],
  [8.17, 0.86],
];

/** Body half-width along the spine, s = 0 at the neck, 1 at the tail tip. */
function halfWidth(s: number): number {
  return 0.135 * Math.pow(1 - s, 0.55) * (0.72 + 0.28 * Math.min(1, s * 8));
}

interface Frame {
  x: number;
  y: number;
  nx: number; // unit normal, "up" relative to travel
  ny: number;
  s: number; // 0..1 along the body
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  return (
    0.5 *
    (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t2 * t)
  );
}

let frameCache: { scale: number; frames: Frame[] } | null = null;
/** Smooths the control points into a dense polyline with normals. Cached: the
 *  body gets stamped several times per atlas and the spine never changes. */
function buildFrames(scale: number, samplesPerSpan = 26): Frame[] {
  if (frameCache && frameCache.scale === scale) return frameCache.frames;
  const pts: [number, number][] = [];
  const n = SPINE.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = SPINE[Math.max(0, i - 1)];
    const p1 = SPINE[i];
    const p2 = SPINE[i + 1];
    const p3 = SPINE[Math.min(n - 1, i + 2)];
    for (let k = 0; k < samplesPerSpan; k++) {
      const t = k / samplesPerSpan;
      pts.push([catmull(p0[0], p1[0], p2[0], p3[0], t) * scale, catmull(p0[1], p1[1], p2[1], p3[1], t) * scale]);
    }
  }
  pts.push([SPINE[n - 1][0] * scale, SPINE[n - 1][1] * scale]);

  const frames: Frame[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    frames.push({ x: pts[i][0], y: pts[i][1], nx: -ty, ny: tx, s: i / (pts.length - 1) });
  }
  frameCache = { scale, frames };
  return frames;
}

/** Traces a closed outline around the spine at the given half-widths.
 *  `shift` slides the centreline along the normal, which is how the shading
 *  bands below get an off-centre highlight. */
function ribbonPath(
  ctx: CanvasRenderingContext2D,
  f: Frame[],
  w: (s: number) => number,
  grow = 0,
  shift = 0,
) {
  ctx.beginPath();
  for (let i = 0; i < f.length; i++) {
    const p = f[i];
    const h = w(p.s) + grow;
    const cx = p.x + p.nx * shift;
    const cy = p.y + p.ny * shift;
    if (i === 0) ctx.moveTo(cx + p.nx * h, cy + p.ny * h);
    else ctx.lineTo(cx + p.nx * h, cy + p.ny * h);
  }
  for (let i = f.length - 1; i >= 0; i--) {
    const p = f[i];
    const h = w(p.s) + grow;
    ctx.lineTo(p.x + p.nx * (shift - h), p.y + p.ny * (shift - h));
  }
  ctx.closePath();
}

/** Catmull-Rom through a short control list, so limbs/horns/whiskers come out
 *  as organic curves. Without this a 3-point stroke is literally a polygon,
 *  which made every appendage read as an angular shard. */
function smoothPts(src: [number, number][], per = 12): [number, number][] {
  if (src.length < 3) return src;
  const out: [number, number][] = [];
  for (let i = 0; i < src.length - 1; i++) {
    const p0 = src[Math.max(0, i - 1)];
    const p1 = src[i];
    const p2 = src[i + 1];
    const p3 = src[Math.min(src.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      out.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  out.push(src[src.length - 1]);
  return out;
}

function taperedStroke(
  ctx: CanvasRenderingContext2D,
  ctrl: [number, number][],
  w0: number,
  w1: number,
  fill: string,
) {
  const pts = smoothPts(ctrl);
  ctx.beginPath();
  const n = pts.length;
  const side = (dir: 1 | -1) => {
    for (let k = 0; k < n; k++) {
      const i = dir === 1 ? k : n - 1 - k;
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let ty = b[1] - a[1];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const h = (w0 + (w1 - w0) * (i / (n - 1))) * dir;
      const x = pts[i][0] - ty * h;
      const y = pts[i][1] + tx * h;
      if (k === 0 && dir === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  side(1);
  side(-1);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

const INK = "#0d0d0d";
const BODY = "#d7d7d7";
const BODY_HI = "#ffffff";
const BODY_LO = "#8f8f8f";
const HORN = "#efefef";

function drawLimb(ctx: CanvasRenderingContext2D, f: Frame, C: number, dir: 1 | -1) {
  const h = halfWidth(f.s) * C;
  // start inside the body so the limb looks joined to it, not stuck on
  const bx = f.x + f.nx * h * 0.35 * dir;
  const by = f.y + f.ny * h * 0.35 * dir;
  // straight out from whichever side of the body this limb is on, then kinked
  // back along it — atan2 takes (y, x), and swapping those mirrored the limb
  // into the body where it was all but invisible
  const out = Math.atan2(f.ny * dir, f.nx * dir);
  const along = Math.atan2(-f.nx, f.ny);
  const L = C * 0.34;

  const k1: [number, number] = [bx + Math.cos(out) * L * 0.42, by + Math.sin(out) * L * 0.42];
  const elbow = out + (along - out) * 0.55 - 0.3 * dir;
  const k2: [number, number] = [k1[0] + Math.cos(elbow) * L * 0.46, k1[1] + Math.sin(elbow) * L * 0.46];

  taperedStroke(ctx, [[bx, by], k1, k2], h * 0.62, h * 0.24, INK);
  taperedStroke(ctx, [[bx, by], k1, k2], h * 0.44, h * 0.14, BODY);

  // three splayed claws
  for (const spread of [-0.6, 0, 0.6]) {
    const a = elbow + spread;
    const mid: [number, number] = [k2[0] + Math.cos(a) * L * 0.2, k2[1] + Math.sin(a) * L * 0.2];
    const tip: [number, number] = [mid[0] + Math.cos(a + 0.45) * L * 0.2, mid[1] + Math.sin(a + 0.45) * L * 0.2];
    taperedStroke(ctx, [k2, mid, tip], h * 0.2, h * 0.012, INK);
    taperedStroke(ctx, [k2, mid, tip], h * 0.12, h * 0.006, HORN);
  }
}

/** Fills a closed, smoothed silhouette. `grow` scales it about its centroid,
 *  which is how the ink outline is laid under the fill. */
function closedShape(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string,
  grow = 0,
  per = 10,
) {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const q of pts) {
    cx += q[0] / n;
    cy += q[1] / n;
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const x = cx + (catmull(p0[0], p1[0], p2[0], p3[0], t) - cx) * (1 + grow);
      const y = cy + (catmull(p0[1], p1[1], p2[1], p3[1], t) - cy) * (1 + grow);
      if (i === 0 && k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, f: Frame[], C: number) {
  const h = f[0];
  // faces away from the neck; +side is the jaw side, towards the body
  const ang = Math.atan2(h.y - f[8].y, h.x - f[8].x);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const R = C * 0.23;
  // +side is the jaw/underside, -side the crown. The perpendicular runs the
  // other way round from the heading here, hence the negated terms — without
  // them the horns and mane sprouted under the chin.
  const at = (fwd: number, side: number): [number, number] => [
    h.x + ca * fwd * R + sa * side * R,
    h.y + sa * fwd * R - ca * side * R,
  ];

  // --- behind the skull, drawn first so the head overlaps their roots ---

  // mane streaming back off the crown
  for (let i = -2; i <= 2; i++) {
    const a = ang + Math.PI + i * 0.4;
    const curl = (i >= 0 ? 1 : -1) * 0.55;
    const root = at(-0.55, i * 0.22 - 0.1);
    const p1: [number, number] = [root[0] + Math.cos(a) * R * 0.62, root[1] + Math.sin(a) * R * 0.62];
    const p2: [number, number] = [p1[0] + Math.cos(a + curl * 0.5) * R * 0.5, p1[1] + Math.sin(a + curl * 0.5) * R * 0.5];
    const p3: [number, number] = [p2[0] + Math.cos(a + curl * 1.3) * R * 0.34, p2[1] + Math.sin(a + curl * 1.3) * R * 0.34];
    taperedStroke(ctx, [root, p1, p2, p3], R * 0.24, R * 0.015, INK);
    taperedStroke(ctx, [root, p1, p2, p3], R * 0.15, R * 0.008, BODY_LO);
  }

  // whiskers: long and heavy-rooted so they still read at cube size
  for (const side of [-1, 1] as const) {
    const w: [number, number][] = [at(0.62, side * 0.3), at(0.15, side * 0.95), at(-0.7, side * 1.3), at(-1.6, side * 0.95)];
    taperedStroke(ctx, w, R * 0.15, R * 0.014, INK);
    taperedStroke(ctx, w, R * 0.09, R * 0.007, HORN);
  }

  // swept-back horns, each with a fork
  for (const side of [-1, 1] as const) {
    const base = at(-0.3, side * 0.34 - 0.28);
    const mid = at(-1.0, side * 0.5 - 0.3);
    const tip = at(-1.7, side * 0.34 - 0.2);
    taperedStroke(ctx, [base, mid, tip], R * 0.22, R * 0.018, INK);
    taperedStroke(ctx, [base, mid, tip], R * 0.14, R * 0.009, HORN);
    const fork = at(-1.5, side * 0.95 - 0.25);
    taperedStroke(ctx, [mid, fork], R * 0.11, R * 0.01, INK);
    taperedStroke(ctx, [mid, fork], R * 0.065, R * 0.005, HORN);
  }

  // --- the head silhouette: crown, brow, snout, jaw, in one closed profile ---
  const profile: [number, number][] = [
    at(-0.78, -0.26),
    at(-0.34, -0.56),
    at(0.2, -0.52),
    at(0.68, -0.42),
    at(1.04, -0.14),
    at(0.96, 0.12),
    at(0.5, 0.26),
    at(-0.05, 0.4),
    at(-0.5, 0.46),
    at(-0.84, 0.18),
  ];
  closedShape(ctx, profile, INK, 0.12);
  closedShape(ctx, profile, BODY);

  // lit crown, kept inside the profile so it models the skull
  closedShape(
    ctx,
    [at(-0.55, -0.24), at(-0.2, -0.42), at(0.3, -0.4), at(0.72, -0.3), at(0.55, -0.12), at(-0.2, -0.06)],
    BODY_HI,
  );

  // mouth line, brow, eye, nostril — the cues that make it read as a face
  taperedStroke(ctx, [at(-0.1, 0.3), at(0.45, 0.16), at(0.95, 0.0)], R * 0.075, R * 0.03, INK);
  taperedStroke(ctx, [at(-0.16, -0.5), at(0.16, -0.56), at(0.44, -0.48)], R * 0.1, R * 0.03, INK);

  const eye = at(0.1, -0.3);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(eye[0], eye[1], R * 0.26, R * 0.16, ang, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BODY_HI;
  ctx.beginPath();
  ctx.arc(eye[0] + ca * R * 0.09, eye[1] + sa * R * 0.09, R * 0.075, 0, Math.PI * 2);
  ctx.fill();

  const nose = at(0.86, -0.16);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(nose[0], nose[1], R * 0.07, 0, Math.PI * 2);
  ctx.fill();
}

/** The whole creature, in atlas pixels. Callers clip and offset it. */
function drawDragon(ctx: CanvasRenderingContext2D, C: number) {
  const f = buildFrames(C);
  const hw = (s: number) => halfWidth(s) * C;

  // dorsal fin, behind the body so only the ridge shows
  ctx.fillStyle = INK;
  for (let i = 8; i < f.length - 6; i += 11) {
    const p = f[i];
    const h = hw(p.s);
    const out = h + C * 0.1 * (1 - p.s);
    // leans back along the body so the ridge looks swept, not like a comb
    const lean = 0.32;
    const tip: [number, number] = [
      p.x + p.nx * out + p.ny * out * lean,
      p.y + p.ny * out - p.nx * out * lean,
    ];
    taperedStroke(ctx, [[p.x, p.y], tip], h * 0.62, C * 0.004, INK);
    taperedStroke(ctx, [[p.x + p.nx * h * 0.3, p.y + p.ny * h * 0.3], tip], h * 0.3, C * 0.002, BODY_LO);
  }

  ribbonPath(ctx, f, hw, C * 0.016);
  ctx.fillStyle = INK;
  ctx.fill();

  // Rounded-tube shading: progressively narrower, brighter bands nudged
  // towards the lit edge. Cheaper than a real gradient along a curve, and it
  // stops the body reading as a flat strip.
  const bands: [number, number, string][] = [
    [1, 0, BODY_LO],
    [0.78, 0.12, BODY],
    [0.46, 0.28, BODY_HI],
  ];
  for (const [k, shift, col] of bands) {
    ribbonPath(ctx, f, (s) => hw(s) * k, 0, hw(0) * shift * (1 - 0.4));
    ctx.fillStyle = col;
    ctx.fill();
  }

  // scales: small overlapping crescents in rows across the body, sized off the
  // local width so they shrink into the tail
  ctx.save();
  ribbonPath(ctx, f, hw);
  ctx.clip();
  ctx.strokeStyle = "rgba(15,15,15,0.42)";
  ctx.lineWidth = Math.max(1, C * 0.005);
  for (let i = 4; i < f.length; i += 5) {
    const p = f[i];
    const h = hw(p.s);
    if (h < C * 0.018) continue;
    const ang = Math.atan2(-p.nx, p.ny);
    for (const lat of [-0.62, 0, 0.62]) {
      ctx.beginPath();
      ctx.arc(p.x + p.nx * h * lat, p.y + p.ny * h * lat, h * 0.36, ang - 1.9, ang + 1.9);
      ctx.stroke();
    }
  }
  ctx.restore();

  // body edge, redrawn so the clipped fills keep a crisp outline
  ribbonPath(ctx, f, hw);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.5, C * 0.011);
  ctx.stroke();

  const legAt = [0.3, 0.63];
  for (let i = 0; i < legAt.length; i++) {
    drawLimb(ctx, f[Math.floor(legAt[i] * (f.length - 1))], C, i % 2 === 0 ? 1 : -1);
  }

  drawHead(ctx, f, C);
}

/** Dark lacquer ground with drifting cloud curls, drawn over the whole atlas
 *  (including cells no face samples) so mip bleeding at cell borders can only
 *  ever pull in more background. */
function drawGround(ctx: CanvasRenderingContext2D, W: number, H: number, C: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a1a1a");
  g.addColorStop(0.5, "#2e2e2e");
  g.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const rnd = (i: number, k: number) => {
    const h = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = Math.max(1, C * 0.012);
  for (let i = 0; i < 90; i++) {
    const x = rnd(i, 1) * W;
    const y = rnd(i, 2) * H;
    const r = C * (0.05 + rnd(i, 3) * 0.16);
    const a0 = rnd(i, 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a0 + 2.2 + rnd(i, 5) * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < 260; i++) {
    ctx.fillRect(rnd(i, 7) * W, rnd(i, 8) * H, C * 0.012, C * 0.012);
  }
}

/**
 * Paints the dragon net. `C` is the size of one face cell in pixels; the
 * canvas must be COLS x C wide and ROWS x C tall.
 */
export function drawDragonNet(ctx: CanvasRenderingContext2D, C: number) {
  const W = COLS * C;
  const H = ROWS * C;

  // flip once so everything below is authored y-up, matching UV space
  ctx.save();
  ctx.translate(0, H);
  ctx.scale(1, -1);

  drawGround(ctx, W, H, C);

  // The band is periodic, so the body is stamped at whole-atlas offsets and
  // clipped per region — that is what carries it around the cube and lets the
  // tail, two laps along, still land on the bottom face.
  const bandRect: [number, number, number, number] = [0, C, W, C];
  const topRect: [number, number, number, number] = [0, 2 * C, C, C];
  const bottomRect: [number, number, number, number] = [0, 0, C, C];

  for (const rect of [bandRect, topRect, bottomRect]) {
    for (let k = -2; k <= 0; k++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect[0], rect[1], rect[2], rect[3]);
      ctx.clip();
      ctx.translate(k * W, 0);
      drawDragon(ctx, C);
      ctx.restore();
    }
  }

  ctx.restore();
}
