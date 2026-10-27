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

const definitions: [string,string,number,number][] = [
  ["afterburn","AFTERBURN",1200,0xffa43f], ["frostwake","FROSTWAKE",800,0x9deaff],
  ["neon-surge","NEON SURGE",1200,0x8bedf9], ["starfall","STARFALL",1200,0xffde94],
  ["petal-drift","PETAL DRIFT",800,0xf7b0d1], ["bubble-pop","BUBBLE POP",600,0x9dece2],
  ["pixel-rush","PIXEL RUSH",600,0xb5ed85], ["gold-rush","GOLD RUSH",1000,0xffd47a],
  ["void-rift","VOID RIFT",1200,0xb799e2], ["rainbow-run","RAINBOW RUN",1000,0xffd2df],
];
export const TRAILS: TrailDef[] = [
  {id:"none",name:"NONE",desc:"Clean roll.",price:0,color:0,previewSwatch:"#171308"},
  ...definitions.map(([id,name,price,color])=>({id,name,price,color,desc:name,previewSwatch:`url(/game-art/runtime-trails/${id}.webp) center / contain no-repeat`}))
];

export const trailById = (id: string): TrailDef =>
  TRAILS.find((t) => t.id === id) ?? TRAILS[0];

/** A steady rolling pass keeps the whole trail visible at every viewing angle. */
export function mountTrailPreview(container: HTMLElement, trail: TrailDef): () => void {
  const speed=3.8;
  const frame={radius:1.45,center:new THREE.Vector3(0,.35,0),cameraDir:new THREE.Vector3(.12,1.1,1)};
  return mountItemPreview(container,frame,(scene,camera)=>{
    const cube=createCubeMesh();scene.add(cube);
    const fx=createTrail(scene,trail);fx.setActive(trail.id!=="none");
    const position=new THREE.Vector3(),focus=new THREE.Vector3();
    let time=0;
    function tick(dt:number){
      time+=dt;
      const x=time*speed,phase=(x%1)*Math.PI/2;
      // The same edge pivot arc as gameplay, viewed side-on for readability.
      cube.position.set(x,.5*(Math.sin(phase)+Math.cos(phase)),0);
      cube.rotation.z=-x*Math.PI/2;
      position.copy(cube.position);fx.update(dt,position,true,camera);
      focus.set(x-speed*TRAIL_LIFE*.35,.35,0);
    }
    for(let i=0;i<60;i++)tick(1/60);
    return {focus,tick,dispose(){fx.dispose();disposeCubeMesh(cube);}};
  });
}
