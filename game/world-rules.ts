export type Realm = "meadow" | "mire" | "cinder" | "cabin";
export type Surface = "grass" | "mud" | "water" | "stone" | "wood" | "ash" | "lava";
export const REALM_NAMES: Record<Realm,string> = { meadow:"GREENWILD", mire:"THE DROWNED MIRE", cinder:"EMBER REACH", cabin:"WAYFARER'S CABIN" };
export const RARE_GATE = { x: 96, z: -72 };
export const HELL_LOCK_MS = 4 * 60 * 60 * 1000;
export const worldHash=(x:number,z:number)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);};
export const mod=(n:number,d:number)=>((n%d)+d)%d;
export interface Landmark { kind:"house"|"portal"|"treasure"; x:number; z:number; id:string; destination?:Realm }
const ROAD_SPACING=64;
function roadLine(cell:number,axis:number){return cell*ROAD_SPACING+Math.floor(worldHash(cell+41,axis+23)*28)-14;}
function hasRoad(cell:number,axis:number){return worldHash(cell-73,axis+61)<.84;}
export function roadsNear(x:number,z:number){
  const vertical:number[]=[],horizontal:number[]=[];
  const cx=Math.round(x/ROAD_SPACING),cz=Math.round(z/ROAD_SPACING);
  for(let i=-1;i<=1;i++){if(hasRoad(cx+i,0))vertical.push(roadLine(cx+i,0));if(hasRoad(cz+i,1))horizontal.push(roadLine(cz+i,1));}
  return {vertical,horizontal};
}
/** Gentle, differently phased bends; keep this formula shared with the terrain shader. */
export function roadCurve(base:number,along:number){
  return base+Math.sin(along*.024+base*.17)*5+Math.sin(along*.009-base*.11)*3;
}
export const ROAD_CURVE_GLSL="float roadCurve(float base,float along){return base+sin(along*.024+base*.17)*5.0+sin(along*.009-base*.11)*3.0;}";
export function roadAt(x:number,z:number){
  const cx=Math.round(x/ROAD_SPACING),cz=Math.round(z/ROAD_SPACING);
  return hasRoad(cx,0)&&Math.abs(x-roadCurve(roadLine(cx,0),z))<.6||hasRoad(cz,1)&&Math.abs(z-roadCurve(roadLine(cz,1),x))<.6;
}
export function housesNear(x:number,z:number):Landmark[]{
  const result:Landmark[]=[],cx=Math.round(x/ROAD_SPACING),cz=Math.round(z/ROAD_SPACING);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const ix=cx+dx,iz=cz+dz;
    if(!hasRoad(ix,0)||!hasRoad(iz,1)||worldHash(ix+71,iz-91)>.32)continue;
    const hz=Math.round(roadCurve(roadLine(iz,1),roadLine(ix,0)))-8-Math.floor(worldHash(ix-17,iz+9)*14),hx=Math.round(roadCurve(roadLine(ix,0),hz));
    result.push({kind:"house",x:hx,z:hz,id:`house:${ix}:${iz}`});
  }
  return result;
}
export function bridgeConnections(x:number,z:number){return (roadAt(x,z-1)?1:0)|(roadAt(x+1,z)?2:0)|(roadAt(x,z+1)?4:0)|(roadAt(x-1,z)?8:0);}
export function landmarksNear(x:number,z:number,realm:Realm):Landmark[] {
  if(realm==="cabin")return [{kind:"treasure",x:3,z:-2,id:"cabin-chest"}];
  const out:Landmark[]=[];
  out.push(...housesNear(x,z));
  out.push({kind:"portal",x:RARE_GATE.x,z:RARE_GATE.z,id:"the-rare-gate",destination:realm==="cinder"?"meadow":"cinder"});
  const tx=Math.floor(x/48),tz=Math.floor(z/48);
  for(let cx=tx-1;cx<=tx+1;cx++)for(let cz=tz-1;cz<=tz+1;cz++){
    if(worldHash(cx+129,cz-93)>.32)continue;
    const px=cx*48+12+Math.floor(worldHash(cx+71,cz)*24),pz=cz*48+12+Math.floor(worldHash(cx,cz-37)*24);
    // Search a small stable neighborhood so treasure never overlaps a rock or lake.
    let placed=false;
    for(let radius=0;radius<=3&&!placed;radius++)for(let dx=-radius;dx<=radius&&!placed;dx++)for(let dz=-radius;dz<=radius&&!placed;dz++){
      const tile=worldTile(px+dx,pz+dz,realm);
      if(!tile.blocked&&tile.surface!=="water"&&tile.surface!=="lava"&&!tile.bridge){out.push({kind:"treasure",x:px+dx,z:pz+dz,id:`chest:${px}:${pz}`});placed=true;}
    }
  }
  return out.filter(p=>Math.max(Math.abs(p.x-x),Math.abs(p.z-z))<=24);
}
/** Stable organic pools, connected roads and sparse obstacles; no stored tile grid. */
type Tile={surface:Surface;blocked:boolean;bridge:boolean};
const tiles=new Map<string,Tile>();
export function worldTile(x:number,z:number,realm:Realm):Tile{
  const key=`${realm}:${x}:${z}`,cached=tiles.get(key);if(cached)return cached;
  const tile=computeTile(x,z,realm);
  if(tiles.size>=8192)tiles.delete(tiles.keys().next().value!);
  tiles.set(key,tile);return tile;
}
function computeTile(x:number,z:number,realm:Realm):Tile {
  if(realm==="cabin")return {surface:"wood",blocked:Math.abs(x)>4||Math.abs(z)>3,bridge:false};
  const houses=housesNear(x,z);
  const houseWall=houses.some(h=>Math.abs(x-h.x)<=2&&z>=h.z-3&&z<=h.z-1);
  if(houseWall)return {surface:realm==="cinder"?"ash":"grass",blocked:true,bridge:false};
  const road=roadAt(x,z);
  const safe=Math.abs(x)<3&&Math.abs(z)<3||Math.abs(x-RARE_GATE.x)<=3&&Math.abs(z-RARE_GATE.z)<=2||houses.some(h=>Math.abs(x-h.x)<=3&&Math.abs(z-(h.z-1))<=3);
  const field=Math.sin(x*.19+Math.sin(z*.11)*1.8)+Math.cos(z*.17+Math.sin(x*.09)*1.3)+Math.sin((x+z)*.07)*.45;
  const wet=!safe&&field>(realm==="mire"?.55:realm==="cinder"?.85:1.3);
  const edge=!safe&&field>(realm==="mire"?.15:1.0);
  let surface:Surface=realm==="cinder"?"ash":realm==="mire"?"mud":"grass";
  if(wet)surface=realm==="cinder"?"lava":"water";
  else if(edge&&realm!=="cinder")surface="mud";
  if(road)surface=wet?"wood":"stone";
  const clearDoor=houses.some(h=>Math.abs(x-h.x)<=2&&Math.abs(z-h.z)<=1);
  // Original obstacle threshold .065; exactly half the random density before road clearances.
  const blocked=!safe&&!road&&!clearDoor&&!wet&&worldHash(x,z)<.0325;
  return {surface,blocked,bridge:road&&wet};
}
export function hellLockRemaining(until:number,now=Date.now()){return Math.max(0,Number.isFinite(until)?until-now:0);}

/** Bridge rails separate the raised deck from the puddle; enter from land at an end. */
export function canTraverse(x:number,z:number,nx:number,nz:number,realm:Realm,insect=false,ignoreTargetObstacle=false){
  const from=worldTile(x,z,realm),to=worldTile(nx,nz,realm);
  if(to.blocked&&!ignoreTargetObstacle||insect&&to.surface==="water")return false;
  if(from.surface==="water"&&to.bridge||from.bridge&&to.surface==="water")return false;
  if(from.bridge&&!roadAt(nx,nz)||to.bridge&&!roadAt(x,z))return false;
  return true;
}

export interface HouseLoot { coins:number; pickup:"coin"|"bolt"|"star"|null; x:number; z:number; heal:boolean }
/** Generated once per house/run; revisits never reroll or refill the chest. */
export function houseLoot(houseId:string,seed:number):HouseLoot {
  let hash=seed|0;for(const c of houseId)hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
  const r=worldHash(hash,57),positions=[[-2,1],[2,0],[-3,-1],[1,-1]];
  const [x,z]=positions[Math.floor(worldHash(hash,62)*positions.length)];
  return {coins:8+Math.floor(worldHash(hash,58)*24),pickup:r<.2?null:r<.5?"coin":r<.78?"bolt":"star",x,z,heal:worldHash(hash,59)<.3};
}

/** Structural cabin walls are destinations/buildings, not breakable obstacle props. */
export function isDestructible(x:number,z:number,realm:Realm){
  if(realm==="cabin"||!worldTile(x,z,realm).blocked)return false;
  return !housesNear(x,z).some(h=>Math.abs(x-h.x)<=2&&z>=h.z-3&&z<=h.z-1);
}
