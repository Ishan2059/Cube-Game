import * as THREE from "three";

const ART_IDS=["magma","boba","glacier","mossling","arcade","nebula","honey","koi","prism"];
const images=new Map<string,HTMLImageElement>();
let preload: Promise<void> | undefined;
export function preloadSkinArt() {
  return preload ??= Promise.all(ART_IDS.map(id=>new Promise<void>(resolve=>{
    const image=new Image();image.onload=()=>{images.set(id,image);resolve();};image.onerror=()=>resolve();
    image.src=`/game-art/materials/${id}.webp`;
  }))).then(()=>{});
}
interface Maps { color:THREE.Texture; bump:THREE.Texture; roughness:THREE.Texture; emission:THREE.Texture; refs:number }
const cache=new Map<string,Maps>();
function texture(image:HTMLImageElement|HTMLCanvasElement,channel:number,color=false) {
  const t=new THREE.Texture(image);t.needsUpdate=true;t.channel=channel;t.anisotropy=4;
  if(color)t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function trimCache() {
  for(const [id,maps] of cache) {
    if(cache.size<=3)break;
    if(maps.refs!==0)continue;
    maps.color.dispose();maps.bump.dispose();maps.roughness.dispose();maps.emission.dispose();cache.delete(id);
  }
}
/** A cube and its preview can share a material set; unused GPU maps are bounded. */
export function acquireSkinMaps(id:string): {maps:Maps;release:()=>void} | null {
  const image=images.get(id);if(!image)return null;
  let maps=cache.get(id);
  if(!maps) {
    const atlas=["boba","koi","arcade"].includes(id),channel=atlas?1:0;
    const source=document.createElement("canvas");source.width=atlas?1024:1024;source.height=atlas?768:1024;
    const c=source.getContext("2d")!;
    if(atlas) {
      for(const [x,y,face] of [[0,1,0],[1,1,1],[2,1,2],[3,1,3],[0,0,4],[0,2,5]]) {
        const quadrant=face===0?0:face===4?2:face===5?3:face===1||id==="boba"?1:3;
        const half=image.width/2;
        c.drawImage(image,(quadrant%2)*half,Math.floor(quadrant/2)*half,half,half,x*256,y*256,256,256);
      }
    } else c.drawImage(image,0,0,1024,1024);
    const mapCanvas=()=>{const canvas=document.createElement("canvas");canvas.width=512;canvas.height=atlas?384:512;return canvas;};
    const bump=mapCanvas(),roughness=mapCanvas(),emission=mapCanvas();
    const bc=bump.getContext("2d")!,rc=roughness.getContext("2d")!,ec=emission.getContext("2d")!;
    bc.drawImage(source,0,0,bump.width,bump.height);
    const original=bc.getImageData(0,0,bump.width,bump.height),height=bc.createImageData(bump.width,bump.height),rough=rc.createImageData(bump.width,bump.height),glow=ec.createImageData(bump.width,bump.height);
    for(let i=0;i<original.data.length;i+=4) {
      const r=original.data[i],g=original.data[i+1],b=original.data[i+2],luma=.3*r+.6*g+.1*b;
      const lava=id==="magma"&&r>g*1.3&&r>155;
      const h=id==="magma"?(lava?25:150+luma*.35):id==="honey"?luma:id==="mossling"?luma*.65+40:128+luma*.12;
      const roughValue=id==="magma"?(lava?80:220):id==="mossling"?220:id==="glacier"?80+(255-luma)*.3:id==="arcade"?110:90;
      for(let k=0;k<3;k++){height.data[i+k]=h;rough.data[i+k]=roughValue;}
      if(lava||(id==="nebula"&&r>95)||(id==="arcade"&&b>170&&g>170&&r<130)) {
        glow.data[i]=r;glow.data[i+1]=g;glow.data[i+2]=b;
      }
      height.data[i+3]=rough.data[i+3]=glow.data[i+3]=255;
    }
    bc.putImageData(height,0,0);rc.putImageData(rough,0,0);ec.putImageData(glow,0,0);
    maps={color:texture(source,channel,true),bump:texture(bump,channel),roughness:texture(roughness,channel),emission:texture(emission,channel,true),refs:0};cache.set(id,maps);
  }
  maps.refs++;cache.delete(id);cache.set(id,maps);trimCache();
  let released=false;
  return {maps,release(){if(released)return;released=true;maps!.refs--;trimCache();}};
}
