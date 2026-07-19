/* ================= cube skins =================
 * Cosmetic textures for the cube, bought with coins in the Shop. Every skin
 * is a GRAYSCALE canvas texture: the material's color still swaps per level
 * (levels.ts), and since a grayscale map multiplies that color, the pattern
 * stays visible and contrasts against whatever the current level tint is.
 *
 * ids are legacy ("classic"/"venom"/"magma") so saved wallets/equips keep
 * working; display names are the texture themes.
 */

import * as THREE from "three";

export interface SkinDef {
  id: "classic" | "venom" | "magma";
  name: string;
  desc: string;
  price: number; // coins; 0 = owned from the start
  roughness: number;
  /** layered CSS background for the shop/hero preview cube */
  previewConic: string;
}

const conic = (a: string, b: string, c: string) =>
  `conic-gradient(from 0deg at 50% 50%, ${a} 0deg 63.43deg, ${b} 63.43deg 180deg, ${c} 180deg 296.57deg, ${a} 296.57deg 360deg)`;

export const SKINS: SkinDef[] = [
  {
    id: "classic",
    name: "ROCKY",
    desc: "Cracked stone shell. Every level recolours it — the cracks stay.",
    price: 0,
    roughness: 0.6,
    previewConic:
      "linear-gradient(115deg, transparent 40%, rgba(0,0,0,0.45) 41.5%, transparent 43%), " +
      "linear-gradient(62deg, transparent 62%, rgba(0,0,0,0.38) 63.5%, transparent 65%), " +
      "linear-gradient(158deg, transparent 22%, rgba(0,0,0,0.3) 23%, transparent 24.5%), " +
      conic("#ded8cc", "#7f7a6f", "#4e4a42"),
  },
  {
    id: "venom",
    name: "DRAGON",
    desc: "Overlapping dragon scales. Sheds nothing, fears nothing.",
    price: 320,
    roughness: 0.45,
    previewConic:
      "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.3) 26%, transparent 28%) 0 0 / 13px 13px, " +
      "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.3) 26%, transparent 28%) 6.5px 6.5px / 13px 13px, " +
      conic("#d6ff4a", "#86c21a", "#3f5e0a"),
  },
  {
    id: "magma",
    name: "RUBIX",
    desc: "3×3 sticker grid. Never solved — always crushing.",
    price: 500,
    roughness: 0.35,
    previewConic:
      "linear-gradient(rgba(10,10,10,0.75) 2.5px, transparent 2.5px) 0 0 / 33.34% 33.34%, " +
      "linear-gradient(90deg, rgba(10,10,10,0.75) 2.5px, transparent 2.5px) 0 0 / 33.34% 33.34%, " +
      conic("#f0ede4", "#b8b4a8", "#8a867a"),
  },
];

export const skinById = (id: string): SkinDef =>
  SKINS.find((s) => s.id === id) ?? SKINS[0];

/* ---------- procedural skin textures (grayscale, level-tintable) ---------- */

function h2(x: number, z: number) {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function makeRockyTexture(ctx: CanvasRenderingContext2D, T: number) {
  // mottled stone base
  ctx.fillStyle = "#d4d4d4";
  ctx.fillRect(0, 0, T, T);
  for (let i = 0; i < 260; i++) {
    const v = 190 + h2(i, 7) * 50;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const s = 6 + h2(i, 3) * 22;
    ctx.beginPath();
    ctx.arc(h2(i, 1) * T, h2(i, 2) * T, s, 0, Math.PI * 2);
    ctx.fill();
  }
  // jagged cracks: random walks with branches
  ctx.strokeStyle = "rgba(30,30,30,0.85)";
  ctx.lineCap = "round";
  for (let c = 0; c < 7; c++) {
    let x = h2(c, 11) * T,
      y = h2(c, 13) * T;
    let a = h2(c, 17) * Math.PI * 2;
    ctx.lineWidth = 2.5 + h2(c, 19) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 8 + ((h2(c, 23) * 6) | 0);
    for (let s = 0; s < steps; s++) {
      a += (h2(c * 31, s) - 0.5) * 1.4;
      x += Math.cos(a) * (10 + h2(s, c) * 16);
      y += Math.sin(a) * (10 + h2(s, c) * 16);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // thin branch off the midpoint
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (h2(c, 29) - 0.5) * 50, y + (h2(c, 37) - 0.5) * 50);
    ctx.stroke();
  }
  // dark speckle
  ctx.fillStyle = "rgba(40,40,40,0.5)";
  for (let i = 0; i < 90; i++) {
    ctx.fillRect(h2(i, 41) * T, h2(i, 43) * T, 2 + h2(i, 47) * 3, 2 + h2(i, 53) * 3);
  }
}

function makeDragonTexture(ctx: CanvasRenderingContext2D, T: number) {
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, T, T);
  // overlapping scale rows, drawn bottom-up so upper rows overlap lower
  const R = 20; // scale radius
  const rowH = R * 0.72;
  let row = 0;
  for (let y = T + R; y > -R; y -= rowH, row++) {
    const off = row % 2 ? R : 0;
    for (let x = -R + off; x < T + R; x += R * 2) {
      // each scale: light crown fading to dark rim = depth without color
      const g = ctx.createRadialGradient(x, y - R * 0.55, R * 0.15, x, y, R);
      g.addColorStop(0, "#e8e8e8");
      g.addColorStop(0.75, "#9a9a9a");
      g.addColorStop(1, "#3c3c3c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(25,25,25,0.7)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }
}

function makeRubixTexture(ctx: CanvasRenderingContext2D, T: number) {
  // black frame + 3×3 stickers in distinct GRAY values: the level colour
  // tints the whole face, gray steps keep the sticker mosaic readable
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 0, T, T);
  const gap = T * 0.035;
  const cell = (T - gap * 4) / 3;
  const shades = [235, 150, 205, 110, 250, 170, 130, 220, 90];
  let i = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++, i++) {
      const x = gap + c * (cell + gap);
      const y = gap + r * (cell + gap);
      const v = shades[i];
      // sticker with a soft top-light bevel
      const g = ctx.createLinearGradient(x, y, x, y + cell);
      g.addColorStop(0, `rgb(${Math.min(255, v + 18)},${Math.min(255, v + 18)},${Math.min(255, v + 18)})`);
      g.addColorStop(1, `rgb(${v - 25},${v - 25},${v - 25})`);
      ctx.fillStyle = g;
      const rad = cell * 0.16;
      ctx.beginPath();
      ctx.roundRect(x, y, cell, cell, rad);
      ctx.fill();
    }
  }
}

const texCache = new Map<string, THREE.CanvasTexture>();

/** Grayscale skin texture, cached per skin id. */
export function getSkinTexture(id: SkinDef["id"]): THREE.CanvasTexture {
  const hit = texCache.get(id);
  if (hit) return hit;
  const T = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = T;
  const ctx = cv.getContext("2d")!;
  if (id === "classic") makeRockyTexture(ctx, T);
  else if (id === "venom") makeDragonTexture(ctx, T);
  else makeRubixTexture(ctx, T);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  texCache.set(id, tex);
  return tex;
}
