import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Author with simple articulated pieces, render with one material/draw call. */
export function bakeModel(source: THREE.Group, animated = false): THREE.Mesh {
  source.updateMatrixWorld(true);
  const parts: THREE.Mesh[] = [];
  source.traverse(o => { if (o instanceof THREE.Mesh) parts.push(o); });
  const geometries = parts.map((part, index) => {
    const geometry = (part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone());
    geometry.applyMatrix4(part.matrixWorld);
    geometry.deleteAttribute("uv");
    const count = geometry.getAttribute("position").count;
    const color = (part.material as THREE.MeshStandardMaterial).color;
    const painted = geometry.getAttribute("color");
    const colors = new Float32Array(count * 3);
    const skinIndices = new Uint16Array(count * 4);
    const weights = new Float32Array(count * 4);
    for (let v = 0; v < count; v++) {
      colors.set([color.r * (painted?.getX(v) ?? 1), color.g * (painted?.getY(v) ?? 1), color.b * (painted?.getZ(v) ?? 1)], v * 3);
      skinIndices[v * 4] = index;
      weights[v * 4] = 1;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (animated) {
      geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndices, 4));
      geometry.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4));
    }
    return geometry;
  });
  const geometry = mergeGeometries(geometries, false)!;
  geometries.forEach(g => g.dispose());
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.08 });
  const mesh = animated ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (mesh instanceof THREE.SkinnedMesh) {
    const bones = parts.map(part => {
      const bone = new THREE.Bone();
      part.matrixWorld.decompose(bone.position, bone.quaternion, bone.scale);
      mesh.add(bone);
      return bone;
    });
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    // Bone poses move beyond the bind-pose box; creatures are already culled by the engine.
    mesh.computeBoundingSphere();
    if(mesh.boundingSphere)mesh.boundingSphere.radius*=1.6;
    mesh.frustumCulled = true;
    bones.forEach(b=>{b.updateMatrix();b.matrixAutoUpdate=false;});
    mesh.userData.animate = (t: number) => {
      source.userData.animate?.(t);
      source.updateMatrixWorld(true);
      parts.forEach((part, i) => {part.matrixWorld.decompose(bones[i].position, bones[i].quaternion, bones[i].scale);bones[i].updateMatrix();});
    };
  }
  // CPU transform objects remain for the rig; their authoring GPU resources are never rendered.
  const mats = new Set<THREE.Material>();
  const geos = new Set<THREE.BufferGeometry>();
  parts.forEach(p => { geos.add(p.geometry); mats.add(p.material as THREE.Material); });
  geos.forEach(g => g.dispose());
  mats.forEach(m => m.dispose());
  return mesh;
}

export function ball(parent: THREE.Object3D, color: number, x: number, y: number, z: number,
  sx: number, sy = sx, sz = sx, segments = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(4, Math.round(segments * .6))),
    new THREE.MeshStandardMaterial({ color }));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}

export function link(parent: THREE.Object3D, color: number, a: number[], b: number[], radius: number, tip = radius): THREE.Mesh {
  const start = new THREE.Vector3(...a as [number, number, number]);
  const end = new THREE.Vector3(...b as [number, number, number]);
  const delta = end.clone().sub(start);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(tip, radius, delta.length(), 8),
    new THREE.MeshStandardMaterial({ color }));
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  parent.add(m);
  return m;
}

export function disposeModel(root: THREE.Object3D) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse(o => {
    o.userData.releaseSkin?.();
    if (!(o instanceof THREE.Mesh)) return;
    geos.add(o.geometry);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m));
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
  });
  geos.forEach(g => g.dispose());
  mats.forEach(m => m.dispose());
}
