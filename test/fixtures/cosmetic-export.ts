import * as THREE from "three";
import {makeParasiteMesh,TYPES,type ParasiteType} from "../../game/parasites";
import {disposeModel} from "../../game/model";
import { SKINS, applySkin, skinById } from "../../game/skins";
import { TRAILS, trailById } from "../../game/trails";
import { preloadTrailArt } from "../../game/trail-art";
import { preloadSkinArt } from "../../game/skin-materials";
import { createCubeMesh, disposeCubeMesh } from "../../game/cubeMesh";
import { createTrail } from "../../game/effects";
import { getStudioEnvironment } from "../../game/lighting";

const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(2048,2048);
function stage(){
  const scene=new THREE.Scene();scene.environment=getStudioEnvironment();scene.add(new THREE.HemisphereLight(0xfff2dc,0x2c2418,1.2));
  const sun=new THREE.DirectionalLight(0xffe6c0,1.8);sun.position.set(2,3,2);scene.add(sun);return scene;
}
export const catalog={creatures:Object.keys(TYPES),skins:SKINS.map(s=>s.id),trails:TRAILS.filter(t=>t.id!=="none").map(t=>t.id)};
export async function skin(id:string){
  await preloadSkinArt();const scene=stage(),cube=createCubeMesh();applySkin(cube,skinById(id));scene.add(cube);
  const camera=new THREE.PerspectiveCamera(34,1,.1,20);camera.position.set(.72,.72,1).normalize().multiplyScalar(3.4);camera.lookAt(0,.06,0);
  renderer.render(scene,camera);const png=renderer.domElement.toDataURL("image/png");scene.remove(cube);disposeCubeMesh(cube);return png;
}
export async function trail(id:string){
  await preloadTrailArt();
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,20),fx=createTrail(scene,trailById(id));
  const center=new THREE.Vector3(4.8,0,0);camera.position.copy(center).add(new THREE.Vector3(0,3.7,3));camera.lookAt(center);camera.updateMatrixWorld();
  const p=new THREE.Vector3();for(let i=0;i<100;i++){const t=i/60;p.set(t*3.6,0,Math.sin(t*5)*.26);fx.update(1/60,p,true,camera);}
  renderer.render(scene,camera);const png=renderer.domElement.toDataURL("image/png");fx.dispose();return png;
}

export async function creature(id:string){
  const scene=stage(),bug=makeParasiteMesh(id as ParasiteType);scene.add(bug);bug.userData.animate(.2);
  const box=new THREE.Box3().setFromObject(bug),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const camera=new THREE.PerspectiveCamera(32,1,.01,20);camera.position.copy(center).add(new THREE.Vector3(1,.8,1).normalize().multiplyScalar(Math.max(size.x,size.y,size.z)*2.5));camera.lookAt(center);
  renderer.render(scene,camera);const png=renderer.domElement.toDataURL("image/png");disposeModel(bug);return png;
}
