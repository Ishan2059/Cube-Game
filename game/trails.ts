/* ================= trails (motion-triggered afterimage) =================
 * Cosmetic layer on top of skins: a fading particle streak that appears
 * behind the cube only while it's rolling. Purely additive to the skin —
 * equip both at once.
 */

import * as THREE from "three";
import { createCubeMesh, disposeCubeMesh } from "./cubeMesh";
import { createTrail } from "./effects";

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

/** Mounts a live preview: the real cube mesh sliding back and forth inside
 *  `container`, trailing the given effect so its look/motion is obvious at
 *  a glance. Returns a dispose function — call it when the preview closes. */
export function mountTrailPreview(
  container: HTMLElement,
  trail: TrailDef,
): () => void {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2c2418, 1.2));
  const sun = new THREE.DirectionalLight(0xffe6c0, 1.8);
  sun.position.set(2, 3, 2);
  scene.add(sun);

  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
  cam.position.set(0.9, 1.15, 1.7);
  cam.lookAt(0, 0.1, 0);

  const mesh = createCubeMesh();
  scene.add(mesh);

  const fx = createTrail(scene, trail.color);
  fx.setActive(trail.id !== "none");

  const resize = () => {
    const s = Math.max(1, Math.min(container.clientWidth, container.clientHeight));
    renderer.setSize(s, s, false);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  let t = 0;
  const AMPLITUDE = 0.34;
  const worldPos = new THREE.Vector3();
  const tick = () => {
    const dt = 1 / 60;
    t += dt;
    const x = Math.sin(t * 1.6) * AMPLITUDE;
    mesh.position.x = x;
    mesh.rotation.z = -x * 1.3; // tumbles as it "rolls"
    worldPos.set(x, 0, 0);
    // moving whenever it's not near a turnaround point — mirrors the real
    // game's "trail only while rolling" gate
    const moving = Math.abs(Math.cos(t * 1.6)) > 0.08;
    fx.update(dt, worldPos, moving);
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    fx.dispose();
    disposeCubeMesh(mesh);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
