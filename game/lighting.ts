import * as THREE from "three";

let environment: THREE.CanvasTexture | undefined;
/** Small neutral studio reflection. Shared, with no per-frame capture or extra lights. */
export function getStudioEnvironment() {
  if(environment) return environment;
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=128;
  const c=canvas.getContext("2d")!;
  const ambient=c.createLinearGradient(0,0,0,128);
  ambient.addColorStop(0,"#abbac4");ambient.addColorStop(.5,"#566068");ambient.addColorStop(1,"#292b26");
  c.fillStyle=ambient;c.fillRect(0,0,256,128);
  for(const [x,y,r,color] of [[45,37,44,"#fff4dc"],[187,49,28,"#c1e1ee"]] as const) {
    const light=c.createRadialGradient(x,y,2,x,y,r);light.addColorStop(0,color);light.addColorStop(.35,color);light.addColorStop(1,"transparent");
    c.fillStyle=light;c.fillRect(0,0,256,128);
  }
  environment=new THREE.CanvasTexture(canvas);environment.mapping=THREE.EquirectangularReflectionMapping;environment.colorSpace=THREE.SRGBColorSpace;
  return environment;
}
