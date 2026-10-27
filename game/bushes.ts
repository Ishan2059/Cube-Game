import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bushPatchesNear } from "./cover";
import { worldHash, type Realm } from "./world-rules";

/** A 3x3 cover patch with a softly faceted canopy and damped contact springs. */
export function createBushes(scene:THREE.Scene){
  const pieces:THREE.BufferGeometry[]=[];
  for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){
    const source=new THREE.IcosahedronGeometry(1,1),g=source.index?source.toNonIndexed():source;
    if(g!==source)source.dispose();
    const height=.75+worldHash(x+19,z+33)*.22;
    g.scale(.66,height,.66);g.translate(x,height*.5,z);
    const colors=new Float32Array(g.attributes.position.count*3),color=new THREE.Color();
    for(let i=0;i<g.attributes.position.count;i+=3){
      color.setHex([0x354d28,0x405b2d,0x4c6835,0x56743a][Math.floor(worldHash(i+x*17,z+5)*4)]);
      for(let j=0;j<3;j++)color.toArray(colors,(i+j)*3);
    }
    g.setAttribute("color",new THREE.BufferAttribute(colors,3));pieces.push(g);
  }
  const geometry=mergeGeometries(pieces,false)!;pieces.forEach(g=>g.dispose());
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,flatShading:true});
  const contacts=Array.from({length:6},()=>new THREE.Vector4(999,999,9,0));let cursor=0;
  const uniforms={uWind:{value:0},uCube:{value:new THREE.Vector3(999,0,999)},uContacts:{value:contacts}};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='uniform float uWind;uniform vec3 uCube;uniform vec4 uContacts[6];\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 world=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;
      float tip=smoothstep(0.0,1.2,position.y);
      transformed.x+=sin(uWind*1.7+world.x*.8+world.z*.5)*.035*tip;
      transformed.z+=cos(uWind*1.2+world.z*.9)*.025*tip;
      vec2 away=world.xz-uCube.xz;float dist=length(away);
      transformed.xz+=away/max(.12,dist)*max(0.0,1.1-dist)*tip*.38;
      transformed.y-=max(0.0,1.0-dist)*tip*.25;
      for(int i=0;i<6;i++){
        vec2 delta=world.xz-uContacts[i].xy;float d=length(delta),age=uContacts[i].z;
        float spring=sin(age*13.0-d*2.0)*exp(-age*3.4)*exp(-d*d*.8)*uContacts[i].w;
        transformed.xz+=delta/max(.12,d)*spring*tip*.12;
        transformed.y+=spring*tip*.045;
      }
    `);
  };
  const mesh=new THREE.InstancedMesh(geometry,material,48);mesh.frustumCulled=false;mesh.count=0;mesh.receiveShadow=true;scene.add(mesh);
  const dummy=new THREE.Object3D(),previous=new THREE.Vector3(999,0,999);let accumulated=0;
  return {
    sync(x:number,z:number,realm:Realm){
      const patches=bushPatchesNear(x,z,realm).slice(0,48);
      patches.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.count=patches.length;mesh.instanceMatrix.needsUpdate=true;
    },
    update(dt:number,cube:THREE.Vector3){
      uniforms.uWind.value+=dt;uniforms.uCube.value.copy(cube);contacts.forEach(c=>c.z+=dt);
      const distance=Math.hypot(cube.x-previous.x,cube.z-previous.z);
      if(distance>3){contacts.forEach(c=>c.z=9);accumulated=0;}else accumulated+=distance;
      if(accumulated>.28){contacts[cursor++%contacts.length].set(cube.x,cube.z,0,Math.min(1,distance/Math.max(.001,dt)/4));accumulated=0;}
      previous.copy(cube);
    },
    dispose(){scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();}
  };
}
