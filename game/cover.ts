import { worldTile, worldHash, type Realm } from "./world-rules";
export interface BushPatch { x:number; z:number }
const validPatches = new Map<string,boolean>();
function validPatch(x:number,z:number,realm:Realm){
  const key=`${realm}:${x}:${z}`;
  const cached=validPatches.get(key);if(cached!==undefined)return cached;
  let valid=true;
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const t=worldTile(x+dx,z+dz,realm);
    if(t.blocked||t.surface!=="grass"&&t.surface!=="mud")valid=false;
  }
  // Bound memory while exploring an unlimited world.
  if(validPatches.size>=512)validPatches.delete(validPatches.keys().next().value!);
  validPatches.set(key,valid);return valid;
}
export function bushPatchAt(x:number,z:number,realm:Realm):BushPatch|null {
  if(realm==="cabin"||realm==="cinder")return null;
  const cx=Math.round((x-5)/13)*13+5,cz=Math.round((z-5)/13)*13+5;
  if(Math.abs(x-cx)>1||Math.abs(z-cz)>1)return null;
  return worldHash(cx+91,cz-41)<.28&&validPatch(cx,cz,realm)?{x:cx,z:cz}:null;
}
export function bushAt(x:number,z:number,realm:Realm){return bushPatchAt(x,z,realm)!==null;}
export function bushPatchesNear(x:number,z:number,realm:Realm){
  const patches=new Map<string,BushPatch>();
  for(let ix=Math.floor(x)-16;ix<=x+16;ix++)for(let iz=Math.floor(z)-16;iz<=z+16;iz++){
    const p=bushPatchAt(ix,iz,realm);if(p)patches.set(`${p.x}:${p.z}`,p);
  }
  return [...patches.values()];
}
/** Cover lasts while the cube is inside; enemies retain only its last visible position. */
export function createCover(){
  let inside=false,lastX=0,lastZ=0;
  return {
    get hidden(){return inside;},
    get target(){return {x:lastX,z:lastZ};},
    update(_dt:number,covered:boolean,x:number,z:number){
      const entered=covered&&!inside;
      if(!covered){lastX=x;lastZ=z;}
      inside=covered;return entered;
    },
    reset(){inside=false;lastX=lastZ=0;}
  };
}
