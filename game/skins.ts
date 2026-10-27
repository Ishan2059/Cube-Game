import * as THREE from "three";
import { createCubeMesh, disposeCubeMesh } from "./cubeMesh";
import { mountItemPreview } from "./itemPreview";
import { acquireSkinMaps } from "./skin-materials";
import { bakeModel, ball, link, disposeModel } from "./model";

export interface SkinDef { id: string; name: string; desc: string; price: number; roughness: number }
export const SKINS: SkinDef[] = [
  { id: "classic", name: "CLASSIC", desc: "The original cube.", price: 0, roughness: .55 },
  { id: "magma", name: "MAGMA", desc: "Molten seams. Obsidian armour.", price: 1600, roughness: .6 },
  { id: "boba", name: "BOBA BUDDY", desc: "Caramel swirls and tapioca pearls.", price: 600, roughness: .32 },
  { id: "gummy", name: "GUMMY POP", desc: "A glossy strawberry chew.", price: 600, roughness: .2 },
  { id: "glacier", name: "GLACIER", desc: "Carved from blue ice.", price: 1000, roughness: .25 },
  { id: "mossling", name: "MOSSLING", desc: "A little forest spirit.", price: 600, roughness: .65 },
  { id: "arcade", name: "ARCADE", desc: "Pocket-sized high scores.", price: 1000, roughness: .4 },
  { id: "nebula", name: "NEBULA", desc: "A pocket of starlight.", price: 1600, roughness: .3 },
  { id: "honey", name: "HONEYDROP", desc: "Golden honeycomb.", price: 600, roughness: .25 },
  { id: "koi", name: "TIDEPOOL", desc: "A quiet koi pond.", price: 1000, roughness: .25 },
  { id: "prism", name: "PRISM", desc: "Soft iridescent bands.", price: 1600, roughness: .22 },
];
export const skinById = (id: string) => SKINS.find(s => s.id === id) ?? SKINS[0];
function accessories(id: string) {
  const g = new THREE.Group();
  if (id === "boba") {
    link(g,0xf5edce,[.18,.45,-.16],[.25,.78,-.16],.055);
    for(let i=0;i<4;i++) {
      const t=.2+i*.2;
      link(g,0xb96955,[.18+.07*t,.45+.33*t,-.16],[.18+.07*(t+.085),.45+.33*(t+.085),-.16],.056);
    }
    ball(g,0x573a32,.25,.78,-.16,.046,.015,.046);
  }
  if (id === "mossling") {
    link(g,0x607f32,[.05,.49,0],[.06,.75,0],.025);
    const leaf=ball(g,0x88b84c,-.03,.7,0,.13,.045,.06); leaf.rotation.z=-.45;
    const leaf2=ball(g,0xa4c75b,.15,.76,0,.14,.045,.065); leaf2.rotation.z=.45;
    link(g,0xf1d7ab,[-.25,.48,.08],[-.25,.62,.08],.025);
    ball(g,0xc97444,-.25,.64,.08,.1,.045,.08);
    for(const [x,z] of [[-.28,.06],[-.22,.1],[-.25,.04]]) ball(g,0xffe8bd,x,.68,z,.013,.005,.012);
  }
  if(id==="honey") for(const x of [-.27,.23]) ball(g,0xf4b833,x,.31,.492,.045,.17,.025);
  if(!g.children.length) return null;
  const mesh=bakeModel(g); mesh.name="skin-accessories"; return mesh;
}
export function applySkin(mesh: THREE.Mesh, skin: SkinDef) {
  if(mesh.userData.skinId === skin.id) return;
  mesh.userData.skinId=skin.id;
  mesh.userData.releaseSkin?.();
  const acquired=acquireSkinMaps(skin.id);
  mesh.userData.releaseSkin=acquired?.release;
  const mat=mesh.material as THREE.MeshPhysicalMaterial;
  mat.color.setHex(skin.id==="classic"?0xf0e8d8:skin.id==="gummy"?0xfc2550:0xffffff);
  mat.map=acquired?.maps.color ?? null;
  mat.bumpMap=acquired?.maps.bump ?? null;
  mat.roughnessMap=acquired?.maps.roughness ?? null;
  mat.bumpScale=skin.id==="magma"?.055:skin.id==="mossling"?.045:.012;
  mat.roughness=skin.id==="gummy"?.14:skin.roughness;
  mat.metalness=skin.id==="prism"?.42:.015;
  mat.clearcoat=skin.id==="magma"||skin.id==="mossling"?.08:.75;
  mat.clearcoatRoughness=.2;
  mat.iridescence=skin.id==="prism"?.6:0;
  mat.iridescenceIOR=1.3;
  mat.emissive.setHex(acquired?0xffffff:0);
  mat.emissiveMap=acquired?.maps.emission ?? null;
  mat.emissiveIntensity=skin.id==="magma"?.65:.25;
  mat.needsUpdate=true;
  const old=mesh.getObjectByName("skin-accessories");
  if(old) { mesh.remove(old); disposeModel(old); }
  const extra=accessories(skin.id); if(extra) mesh.add(extra);
  const eyes=mesh.getObjectByName("cube-eyes"); if(eyes) eyes.visible=skin.id!=="arcade";
}
/** These portraits are exported from this exact model/material factory. */
export function getSkinThumbnail(skin: SkinDef): string {
  return `/game-art/runtime-skins/${skin.id}.webp`;
}
export function mountSkinPreview(container: HTMLElement, skin: SkinDef): () => void {
  return mountItemPreview(container,{radius:1.02},scene=>{
    const mesh=createCubeMesh(); applySkin(mesh,skin); scene.add(mesh);
    return {tick(dt){mesh.rotation.y+=dt*.45;},dispose(){disposeCubeMesh(mesh);}};
  });
}
