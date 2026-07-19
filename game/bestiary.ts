/* ================= bestiary =================
 * Guide-screen bug gallery. Thumbnails are the ACTUAL in-game meshes,
 * rendered once to data URLs by a throwaway offscreen WebGL renderer the
 * first time the Guide opens, then cached for the session.
 */

import * as THREE from "three";
import { makeParasiteMesh, type ParasiteType } from "./parasites";

export interface BeastInfo {
  type: ParasiteType;
  name: string;
  desc: string;
}

export const BEASTS: BeastInfo[] = [
  { type: "worm", name: "WORM", desc: "Slow crawler. Free points — roll over it." },
  { type: "bug", name: "BUG", desc: "Standard chaser. Beelines for the cube and climbs on." },
  { type: "spider", name: "SPIDER", desc: "Drops silk webs on the ground that slow your rolling." },
  { type: "scorpion", name: "SCORPION", desc: "Its sting poisons you — health drains for a few seconds." },
  { type: "beetle", name: "BEETLE", desc: "Armored. First crush cracks the shell, second one kills." },
  { type: "slug", name: "SLUG", desc: "Trails sticky slime that stalls you mid-roll." },
  { type: "termite", name: "TERMITE", desc: "Digs pits that block your path until they collapse." },
  { type: "hornet", name: "HORNET", desc: "Its bite dazes you — controls invert for a moment." },
  { type: "mosquito", name: "MOSQUITO", desc: "Drains double health when it bites. Squash fast." },
  { type: "pillbug", name: "PILLBUG", desc: "Curls into an armored ball while moving — only crushable when still." },
  { type: "flea", name: "FLEA", desc: "Erratic hopper. Hard to land on — corner it." },
  { type: "locust", name: "LOCUST", desc: "Lunges two tiles straight at you every few seconds." },
  { type: "eggsac", name: "EGG SAC", desc: "Hatches a brood of bugs if you ignore it. Crush on sight." },
  { type: "spitter", name: "SPITTER", desc: "Lobs acid globs from range — keep moving or eat the splat. Close the gap and crush it." },
];

let cache: Record<string, string> | null = null;

/** Render each bug mesh once to a PNG data URL (cached per session). */
export function getBugThumbs(): Record<string, string> {
  if (cache) return cache;
  const SIZE = 148;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2c2418, 1.15));
  const sun = new THREE.DirectionalLight(0xffe6c0, 1.7);
  sun.position.set(2, 3, 2);
  scene.add(sun);

  const cam = new THREE.PerspectiveCamera(35, 1, 0.02, 20);
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  cache = {};
  for (const b of BEASTS) {
    const mesh = makeParasiteMesh(b.type);
    mesh.userData.animate?.(0.4); // natural mid-crawl pose
    scene.add(mesh);
    box.setFromObject(mesh);
    box.getCenter(center);
    box.getSize(size);
    const d = Math.max(size.length() * 1.15, 0.4);
    cam.position.set(center.x + d * 0.7, center.y + d * 0.85, center.z + d);
    cam.lookAt(center);
    renderer.render(scene, cam);
    cache[b.type] = renderer.domElement.toDataURL("image/png");
    scene.remove(mesh);
    // thumbnails are one-shot: free the mesh's GPU resources right away
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
  renderer.dispose();
  return cache;
}
