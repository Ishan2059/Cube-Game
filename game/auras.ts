/* ================= auras (always-on ambient halo) =================
 * Cosmetic layer on top of skins: a soft glow that pulses around the cube
 * at all times, movement-independent — the key difference from Trails.
 */

import * as THREE from "three";
import { createCubeMesh, disposeCubeMesh } from "./cubeMesh";
import { createAura } from "./effects";
import { mountItemPreview } from "./itemPreview";

export interface AuraDef {
  id: string;
  name: string;
  desc: string;
  price: number; // coins; 0 = "none", owned from the start
  color: number;
  previewSwatch: string;
}

const glow = (hex: string) =>
  `radial-gradient(circle at 50% 45%, ${hex} 0%, transparent 68%), #171308`;

export const AURAS: AuraDef[] = [
  {
    id: "none",
    name: "NONE",
    desc: "No aura. Just the cube.",
    price: 0,
    color: 0x000000,
    previewSwatch: "#171308",
  },
  {
    id: "halo",
    name: "HALO",
    desc: "A warm gold halo breathes softly, always on.",
    price: 180,
    color: 0xf5e6a8,
    previewSwatch: glow("rgba(245,230,168,0.6)"),
  },
  {
    id: "void",
    name: "VOID",
    desc: "A dark violet glow pulses like it's swallowing the light.",
    price: 300,
    color: 0x8a4ad4,
    previewSwatch: glow("rgba(138,74,212,0.6)"),
  },
  {
    id: "radiant",
    name: "RADIANT",
    desc: "Venom-green light, pulsing steadily — the premium glow.",
    price: 450,
    color: 0xb7f32b,
    previewSwatch: glow("rgba(183,243,43,0.6)"),
  },
];

export const auraById = (id: string): AuraDef =>
  AURAS.find((a) => a.id === id) ?? AURAS[0];

// The halo glow sprite pulses out to scale 2.05 (half-extent 1.025 from the
// cube's center) — bigger than the cube itself, so it's what sets the
// bounding sphere the preview camera needs to fit.
const PREVIEW_RADIUS = 1.05;

/** Mounts a live preview: the real cube mesh idly rotating inside
 *  `container`, with the given aura pulsing around it (always-on, exactly
 *  as it behaves in-game). Returns a dispose function for modal close. */
export function mountAuraPreview(
  container: HTMLElement,
  aura: AuraDef,
): () => void {
  return mountItemPreview(container, PREVIEW_RADIUS, (scene) => {
    const mesh = createCubeMesh();
    scene.add(mesh);

    const fx = createAura(mesh, aura.color);
    fx.setActive(aura.id !== "none");

    let t = 0;
    return {
      tick(dt) {
        t += dt;
        mesh.rotation.y = t * 0.6;
        fx.update(dt);
      },
      dispose() {
        fx.dispose();
        disposeCubeMesh(mesh);
      },
    };
  });
}
