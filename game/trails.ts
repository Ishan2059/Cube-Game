/* ================= trails (motion-triggered afterimage) =================
 * Cosmetic layer on top of skins: a fading particle streak that appears
 * behind the cube only while it's rolling. Purely additive to the skin —
 * equip both at once.
 */

import * as THREE from "three";
import { createCubeMesh, disposeCubeMesh } from "./cubeMesh";
import { createTrail } from "./effects";
import { mountItemPreview } from "./itemPreview";

export interface TrailDef {
  id: string;
  name: string;
  desc: string;
  price: number; // coins; 0 = "none", owned from the start
  color: number;
  /** layered CSS background for the shop card swatch */
  previewSwatch: string;
}

const glow = (hex: string) =>
  `radial-gradient(circle at 50% 45%, ${hex} 0%, transparent 68%), #171308`;

export const TRAILS: TrailDef[] = [
  {
    id: "none",
    name: "NONE",
    desc: "No trail. Clean roll.",
    price: 0,
    color: 0x000000,
    previewSwatch: "#171308",
  },
  {
    id: "ember",
    name: "EMBER",
    desc: "A trail of guttering orange embers kicks up behind every roll.",
    price: 150,
    color: 0xff6a3a,
    previewSwatch: glow("rgba(255,106,58,0.55)"),
  },
  {
    id: "frost",
    name: "FROST",
    desc: "Icy motes spray out behind you, gone as fast as they appear.",
    price: 250,
    color: 0x5ad0ff,
    previewSwatch: glow("rgba(90,208,255,0.55)"),
  },
  {
    id: "toxin",
    name: "TOXIN",
    desc: "Venom-green afterimage — the signature crush streak.",
    price: 400,
    color: 0xb7f32b,
    previewSwatch: glow("rgba(183,243,43,0.55)"),
  },
];

export const trailById = (id: string): TrailDef =>
  TRAILS.find((t) => t.id === id) ?? TRAILS[0];

const AMPLITUDE = 0.34;
// Worst case is the cube at full slide with a corner pointing further out
// along the same axis (corner-to-center is a rotation-invariant 0.5*sqrt(3)),
// plus a little slack for the trailing particles' own spread.
const PREVIEW_RADIUS = AMPLITUDE + 0.5 * Math.sqrt(3) + 0.1;

/** Mounts a live preview: the real cube mesh sliding back and forth inside
 *  `container`, trailing the given effect so its look/motion is obvious at
 *  a glance. Returns a dispose function — call it when the preview closes. */
export function mountTrailPreview(
  container: HTMLElement,
  trail: TrailDef,
): () => void {
  return mountItemPreview(container, PREVIEW_RADIUS, (scene) => {
    const mesh = createCubeMesh();
    scene.add(mesh);

    const fx = createTrail(scene, trail.color);
    fx.setActive(trail.id !== "none");

    let t = 0;
    const worldPos = new THREE.Vector3();
    return {
      tick(dt) {
        t += dt;
        const x = Math.sin(t * 1.6) * AMPLITUDE;
        mesh.position.x = x;
        mesh.rotation.z = -x * 1.3; // tumbles as it "rolls"
        worldPos.set(x, 0, 0);
        // moving whenever it's not near a turnaround point — mirrors the
        // real game's "trail only while rolling" gate
        const moving = Math.abs(Math.cos(t * 1.6)) > 0.08;
        fx.update(dt, worldPos, moving);
      },
      dispose() {
        fx.dispose();
        disposeCubeMesh(mesh);
      },
    };
  });
}
