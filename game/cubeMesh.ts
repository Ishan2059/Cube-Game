import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { applyNetUvs } from "./cubeNet";
import { bakeModel, ball, disposeModel } from "./model";

/** Shared by the game and live cosmetic previews. */
export function createCubeMesh(size = 1): THREE.Mesh {
  const geo=new RoundedBoxGeometry(size,size,size,4,.095*size); applyNetUvs(geo);
  const mesh=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0xf0e8d8,roughness:.4,clearcoat:.4,clearcoatRoughness:.22,envMapIntensity:.65}));
  mesh.castShadow=true; mesh.receiveShadow=true;
  const face=new THREE.Group();
  for(const x of [-.17,.17]) {
    ball(face,0xfff9e6,x*size,.08*size,.483*size,.105*size,.125*size,.034*size);
    ball(face,0x202432,x*size,.075*size,.515*size,.055*size,.075*size,.023*size);
    ball(face,0xffffff,(x-.014)*size,.105*size,.537*size,.017*size,.022*size,.008*size);
  }
  const eyes=bakeModel(face); eyes.name="cube-eyes"; mesh.add(eyes);
  return mesh;
}
export const disposeCubeMesh = disposeModel;
