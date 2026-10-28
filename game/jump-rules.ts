import { canTraverse, isDestructible, worldTile, type Realm } from "./world-rules";

/** Horizontal range follows velocity; landing snaps to the existing tile grid. */
export function jumpProfile(speed:number){
  const velocity=Math.max(0,Math.min(14,speed));
  const tiles=Math.min(6,Math.round(velocity*.42));
  return {tiles,duration:tiles?tiles/Math.max(1,velocity):.38,height:.8+velocity*.065};
}
export function canJump(x:number,z:number,dx:number,dz:number,tiles:number,realm:Realm,broken:(x:number,z:number)=>boolean,giant=false){
  for(let step=1;step<=tiles;step++){
    const nx=x+dx*step,nz=z+dz*step,tile=worldTile(nx,nz,realm);
    if(tile.blocked&&!broken(nx,nz)&&!isDestructible(nx,nz,realm))return false;
    if(step===tiles&&tile.blocked&&!broken(nx,nz)&&!giant)return false;
    // Raised bridge rails remain boundaries, including when jumping from water.
    if(!canTraverse(nx-dx,nz-dz,nx,nz,realm,false,true))return false;
  }
  return true;
}
