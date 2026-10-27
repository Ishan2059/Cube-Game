import * as THREE from "three";
const IDS=["afterburn","frostwake","neon-surge","starfall","petal-drift","bubble-pop","pixel-rush","gold-rush","void-rift","rainbow-run"];
const images=new Map<string,HTMLImageElement>();let ready:Promise<void>|undefined;
export function preloadTrailArt(){return ready??=Promise.all(IDS.map(id=>new Promise<void>(resolve=>{const image=new Image();image.onload=()=>{images.set(id,image);resolve();};image.onerror=()=>resolve();image.src=`/game-art/trail-maps/${id}.webp`;}))).then(()=>{});}
/** Separate ribbon and particle regions from reference-derived UV artwork. */
export function trailTexture(id:string,particle=false):THREE.CanvasTexture|null {
  const image=images.get(id);if(!image)return null;
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=particle?256:1024;
  const c=canvas.getContext("2d")!,half=image.width/2;
  if(particle){
    const probe=document.createElement("canvas");probe.width=half;probe.height=image.height;const pc=probe.getContext("2d")!;
    pc.drawImage(image,half,0,half,image.height,0,0,half,image.height);const rgba=pc.getImageData(0,0,half,image.height).data;
    let x0=half,y0=image.height,x1=0,y1=0;
    for(let y=0;y<image.height;y++)for(let x=0;x<half;x++)if(rgba[(y*half+x)*4+3]>48){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    const w=Math.max(1,x1-x0+1),h=Math.max(1,y1-y0+1),scale=240/Math.max(w,h);
    c.drawImage(probe,x0,y0,w,h,(256-w*scale)/2,(256-h*scale)/2,w*scale,h*scale);
  }else c.drawImage(image,0,0,half,image.height,0,0,256,1024);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  if(!particle)texture.wrapT=THREE.MirroredRepeatWrapping;
  return texture;
}
