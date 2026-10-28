import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldTexture } from "./terrain";
export function createBridge(){
  const material=new THREE.MeshStandardMaterial({map:worldTexture("wood"),color:0xf1d6a5,roughness:.87});
  const geometries=new Map<number,THREE.BufferGeometry>();
  return {
    create(connections:number){
      let geometry=geometries.get(connections);
      if(!geometry){
        const parts:THREE.BufferGeometry[]=[];
        const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);parts.push(g);};
        box(1,.07,1,0,.04,0);
        for(let side=0;side<4;side++)if(!(connections&(1<<side))){
          const alongZ=side===1||side===3,sign=side===0||side===3?-1:1;
          for(const end of [-.44,.44])box(.075,.48,.075,alongZ?sign*.49:end,.25,alongZ?end:sign*.49);
          box(alongZ?.06:1,.065,alongZ?1:.06,alongZ?sign*.49:0,.46,alongZ?0:sign*.49);
        }
        geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());geometries.set(connections,geometry);
      }
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;return mesh;
    },
    dispose(){for(const g of geometries.values())g.dispose();material.dispose();}
  };
}
