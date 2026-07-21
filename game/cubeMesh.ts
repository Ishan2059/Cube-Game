/* ================= the cube mesh =================
 * Builds the actual gameplay cube — rounded box + a simple two-eye face.
 * Shared by the live game (engine.ts) and any offscreen preview (e.g. the
 * skin/trail/aura preview modal) so previews always match reality exactly.
 */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { applyNetUvs } from "./cubeNet";

export function createCubeMesh(size = 1): THREE.Mesh {
  const geo = new RoundedBoxGeometry(size, size, size, 4, 0.09 * size);
  // second UV set, for skins whose artwork runs across faces rather than
  // repeating per face — see cubeNet.ts. Default UVs are left as they were.
  applyNetUvs(geo);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.55 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
  });
  for (const sx of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085 * size, 12, 10), eyeMat);
    eye.position.set(sx * size, 0.1 * size, 0.48 * size);
    eye.scale.z = 0.55;
    mesh.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04 * size, 8, 6), pupilMat);
    pupil.position.set(sx * size, 0.1 * size, 0.53 * size);
    pupil.scale.z = 0.5;
    mesh.add(pupil);
  }
  return mesh;
}

/** Frees the mesh's GPU resources (geometry + all materials). */
export function disposeCubeMesh(mesh: THREE.Mesh) {
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
