/* ================= trails (motion-triggered afterimage) =================
 * Cosmetic layer on top of skins: a fading particle streak that appears
 * behind the cube only while it's rolling. Purely additive to the skin —
 * equip both at once.
 */

import * as THREE from "three";
import { createCubeMesh, disposeCubeMesh } from "./cubeMesh";
import { createTrail, TRAIL_LIFE } from "./effects";
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

/* ---------- live trail preview (item modal) ---------- */
// createTrail drops its particles just above y=0 — the ground the cube rolls
// on in the real game — so the preview cube has to rest on that same ground
// (engine.ts places it at TILE/2). Straddling the origin instead buried the
// entire streak inside the cube's own geometry.
const CUBE_Y = 0.5;
// A streak only lives TRAIL_LIFE seconds, and the cube is a full tile wide, so
// the previous ±0.34 back-and-forth slide could never outrun it: every bright
// particle stayed under the cube's own footprint and only the near-invisible
// faded tail emerged, which is why trails previewed as "cube moves, nothing
// trails it". A steady circuit fixes that — the cube never doubles back over
// its own streak, so the arc always trails clear of it.
// A wide, slow circuit rather than a tight one: over the window the camera
// actually shows, the path is near-straight, so the streak lays out across the
// frame instead of curling back on itself.
const ORBIT_R = 3.0;
const ORBIT_SPEED = 1.5; // rad/s; x ORBIT_R = ~4.5 u/s, so the streak outruns the cube
const LEAN = 0.3; // banks into the turn
// Half-height of the banked cube.
const CUBE_HALF = 0.5 * (Math.cos(LEAN) + Math.sin(LEAN));
// How far back the streak reaches: particles are dropped at the cube and live
// TRAIL_LIFE seconds while it travels on at this speed.
const STREAK_LEN = ORBIT_R * ORBIT_SPEED * TRAIL_LIFE;
// The camera tracks a point behind the cube rather than the circuit's centre —
// same idea as the gameplay camera following the cube. That keeps the cube put
// instead of swinging out to the container edge, and leaves room behind it for
// the streak. Sitting the target midway between the cube's leading face and
// the streak's tail balances the two, and re-derives itself if the trail's
// length or speed is ever retuned.
const FOLLOW_BEHIND = Math.max(0, (STREAK_LEN - CUBE_HALF) / 2);
// Fits the cube (ahead of the focus point) and the streak (behind it).
const PREVIEW_RADIUS = Math.hypot(FOLLOW_BEHIND + CUBE_HALF, CUBE_HALF) + 0.05;
// Steeper than the default 3/4 view — the streak lies flat on the ground, and
// a shallow angle foreshortens it into near-invisibility. Roughly matches the
// downward angle the real gameplay camera views the cube from.
const CAMERA_DIR = new THREE.Vector3(0.45, 1.15, 1);

/** Mounts a live preview: the real cube mesh riding a steady circuit inside
 *  `container`, trailing the given effect so its look/motion is obvious at
 *  a glance. Returns a dispose function — call it when the preview closes. */
export function mountTrailPreview(
  container: HTMLElement,
  trail: TrailDef,
): () => void {
  const frame = {
    radius: PREVIEW_RADIUS,
    center: new THREE.Vector3(0, CUBE_Y, 0),
    cameraDir: CAMERA_DIR,
  };
  return mountItemPreview(container, frame, (scene) => {
    const mesh = createCubeMesh();
    mesh.position.y = CUBE_Y;
    scene.add(mesh);

    const fx = createTrail(scene, trail.color);
    fx.setActive(trail.id !== "none");

    let t = 0;
    const worldPos = new THREE.Vector3();
    const focus = new THREE.Vector3(0, CUBE_Y, 0);
    return {
      focus,
      tick(dt) {
        t += dt;
        const a = t * ORBIT_SPEED;
        const x = Math.cos(a) * ORBIT_R;
        const z = Math.sin(a) * ORBIT_R;
        mesh.position.set(x, CUBE_Y, z);
        // heading follows the circuit; the local-Z lean then banks it into
        // whichever way it's currently travelling
        mesh.rotation.set(0, -a, LEAN);
        // same call shape the engine makes — it passes the live cube's
        // position and createTrail drops the particles to ground level
        worldPos.set(x, CUBE_Y, z);
        // always rolling here: a circuit has no turnaround to gate on
        fx.update(dt, worldPos, true);
        // sit the camera's target behind the cube, along the reverse of its
        // travel direction, so the streak occupies the space it leaves
        focus.set(x + Math.sin(a) * FOLLOW_BEHIND, CUBE_Y, z - Math.cos(a) * FOLLOW_BEHIND);
      },
      dispose() {
        fx.dispose();
        disposeCubeMesh(mesh);
      },
    };
  });
}
