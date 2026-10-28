import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { worldTexture } from "./terrain";
import { landmarksNear, type Landmark, type Realm } from "./world-rules";

/** Static pieces share textured materials and are merged by material before rendering. */
function batch(root:THREE.Group){
  root.updateMatrixWorld(true);const bins=new Map<THREE.Material,THREE.BufferGeometry[]>();
  root.traverse(o=>{if(o instanceof THREE.Mesh){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);const m=o.material as THREE.Material;const list=bins.get(m)??[];list.push(g);bins.set(m,list);o.geometry.dispose();}});
  root.clear();for(const [material,geos] of bins){const mesh=new THREE.Mesh(mergeGeometries(geos,false)!,material);geos.forEach(g=>g.dispose());mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}return root;
}
export function createLandmarks(scene:THREE.Scene){
  const wood=new THREE.MeshStandardMaterial({map:worldTexture("wood"),color:0xffffff,roughness:.8});
  const stone=new THREE.MeshStandardMaterial({map:worldTexture("stone"),color:0xc3c9ad,roughness:.9});
  const roof=new THREE.MeshStandardMaterial({map:worldTexture("wood"),color:0x8d7454,roughness:.9});
  const metal=new THREE.MeshStandardMaterial({color:0xe0ad4c,metalness:.62,roughness:.3});
  const glow=new THREE.MeshStandardMaterial({color:0xffd997,emissive:0xffb952,emissiveIntensity:.8});
  const dark=new THREE.MeshStandardMaterial({color:0x1d1812,roughness:.7});
  const materials=[wood,stone,roof,metal,glow,dark];
  const placed=new Map<string,{data:Landmark;root:THREE.Group;hinge?:THREE.Group;open:number;target:number;portal?:THREE.ShaderMaterial}>();
  let interior:THREE.Group|null=null;
  const box=(g:THREE.Group,m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);g.add(mesh);return mesh;};
  function house(){
    const body=new THREE.Group();box(body,stone,5,.2,4,0,.1,-1.8);
    box(body,wood,.18,2.2,3.6,-2.3,1.2,-1.8);box(body,wood,.18,2.2,3.6,2.3,1.2,-1.8);box(body,wood,4.6,2.2,.18,0,1.2,-3.5);
    for(const side of [-1,1]){
      box(body,wood,1.6,2.2,.18,side*1.55,1.2,0);box(body,roof,.16,2.25,.3,side*.72,1.2,.03);
      box(body,dark,.8,.75,.04,side*1.6,1.38,.11);box(body,glow,.65,.6,.05,side*1.6,1.38,.15);
      box(body,roof,.055,.72,.1,side*1.6,1.38,.19);box(body,roof,.8,.055,.1,side*1.6,1.38,.19);
    }
    box(body,roof,1.55,.2,.3,0,2.2,.03);box(body,wood,1.7,.1,.7,0,.05,.4);
    const shape=new THREE.Shape();shape.moveTo(-2.6,2.2);shape.lineTo(0,3.4);shape.lineTo(2.6,2.2);shape.closePath();
    const canopy=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false}),roof);canopy.position.z=-3.7;body.add(canopy);
    box(body,stone,.55,1,.55,1.4,3,-2.5);batch(body);
    const hinge=new THREE.Group();hinge.position.set(-.65,0,.14);box(hinge,wood,1.3,1.95,.1,.65,1.06,0);box(hinge,metal,.08,.08,.09,1.12,1.05,.09);body.add(hinge);
    return {root:body,hinge};
  }
  function chest(){
    const root=new THREE.Group(),base=new THREE.Group();box(base,wood,.8,.45,.58,0,.27,0);box(base,dark,.69,.02,.48,0,.5,0);
    for(const x of [-.27,.27])box(base,metal,.055,.46,.6,x,.27,0);box(base,metal,.14,.18,.055,0,.39,.32);batch(base);root.add(base);
    const hinge=new THREE.Group();hinge.position.set(0,.5,-.29);
    const lid=new THREE.Mesh(new RoundedBoxGeometry(.82,.22,.6,3,.06),wood);lid.position.set(0,.08,.29);hinge.add(lid);
    for(const x of [-.27,.27])box(hinge,metal,.055,.235,.61,x,.08,.29);
    root.add(hinge);return {root,hinge};
  }
  function portal(destination:Realm){
    const root=new THREE.Group(),frame=new THREE.Group();const color=destination==="cinder"?0xff612c:destination==="mire"?0x4dd7c2:0xb6dc74;
    const arch=new THREE.Mesh(new THREE.TorusGeometry(1,.17,8,32),stone);arch.position.y=1.2;frame.add(arch);
    for(const side of [-1,1])box(frame,stone,.45,.5,.6,side*.87,.25,0);batch(frame);root.add(frame);
    const portal=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0},uColor:{value:new THREE.Color(color)},uLocked:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform float uTime,uLocked;uniform vec3 uColor;void main(){vec2 p=vUv-.5;float r=length(p)*2.0,a=atan(p.y,p.x);float swirl=sin(a*4.0-r*18.0+uTime*2.0)+sin(a*7.0+r*11.0-uTime);float rim=pow(r,5.0);vec3 c=uColor*(.15+rim*1.4+swirl*.08);c+=uColor*.35*pow(max(0.0,sin(a*3.0-r*25.0+uTime*3.0)),12.0);c=mix(c,vec3(.10,.09,.08),uLocked*.85);gl_FragColor=vec4(c,(1.0-smoothstep(.94,1.0,r))*.94);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});portal.forceSinglePass=true;
    const veil=new THREE.Mesh(new THREE.CircleGeometry(.96,48),portal);veil.position.y=1.2;root.add(veil);return {root,portal};
  }
  function disposeRoot(root:THREE.Object3D){root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});scene.remove(root);}
  function clear(){for(const item of placed.values()){disposeRoot(item.root);item.portal?.dispose();}placed.clear();if(interior){disposeRoot(interior);interior=null;}}
  function cabin(){
    const g=new THREE.Group();
    box(g,wood,9,.15,7,0,-.04,0);box(g,wood,.22,1.5,7,-4.5,.75,0);box(g,wood,.22,1.5,7,4.5,.75,0);box(g,wood,9,2,.22,0,1,-3.5);
    for(const side of [-1,1])box(g,wood,3.5,.65,.22,side*2.75,.32,3.5);
    for(const x of [-4.3,4.3])box(g,roof,.17,1.7,.2,x,.85,-3.3);
    box(g,stone,1.8,.55,.65,0,.275,-3.0);box(g,dark,1.2,.65,.1,0,.8,-3.3);box(g,glow,.75,.18,.4,0,.35,-2.9);
    box(g,wood,1.35,.12,.8,-2.7,.75,-2.0);for(const x of [-3.2,-2.2])for(const z of [-2.25,-1.75])box(g,roof,.09,.7,.09,x,.35,z);
    box(g,wood,1.1,.12,.45,2.7,1.15,-3.22);for(const x of [2.4,2.7,3])box(g,metal,.12,.3,.13,x,1.36,-3.22);
    box(g,metal,1.4,.025,.3,0,.025,3.34);box(g,wood,1.7,.08,.45,0,.04,3.22);
    batch(g);scene.add(g);interior=g;
  }
  return {
    sync(x:number,z:number,realm:Realm,opened:ReadonlySet<string>,prefix:string){
      const wanted=landmarksNear(x,z,realm).filter(p=>Math.max(Math.abs(p.x-x),Math.abs(p.z-z))<20);
      for(const [key,item] of placed)if(!wanted.some(p=>prefix+p.id===key)){disposeRoot(item.root);item.portal?.dispose();placed.delete(key);}
      if(realm==="cabin"&&!interior)cabin();
      for(const data of wanted){const key=prefix+data.id;if(placed.has(key))continue;
        const result=data.kind==="house"?house():data.kind==="treasure"?chest():portal(data.destination!);
        result.root.position.set(data.x,0,data.z);scene.add(result.root);
        const done=opened.has(key);const item={...result,data,open:done?1:0,target:done?1:0};placed.set(key,item);
      }
    },
    at(x:number,z:number){return [...placed.entries()].find(([,p])=>p.data.x===x&&p.data.z===z);},
    open(key:string){const item=placed.get(key);if(item)item.target=1;},
    update(dt:number,locked:boolean){for(const item of placed.values()){
      item.open+=(item.target-item.open)*(1-Math.exp(-dt*9));
      if(item.hinge){if(item.data.kind==="house")item.hinge.rotation.y=-item.open*1.5;else item.hinge.rotation.x=-item.open*1.25;}
      if(item.portal){item.portal.uniforms.uTime.value+=dt;item.portal.uniforms.uLocked.value=locked&&item.data.destination==="cinder"?1:0;}
    }},
    clear,
    dispose(){clear();materials.forEach(m=>m.dispose());}
  };
}
