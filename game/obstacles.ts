import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { bakeModel, ball, link, disposeModel } from "./model";

/** Shared geometry/material per variation; obstacle positions and collisions stay unchanged. */
export function createObstacleLibrary() {
  const models: THREE.Mesh[]=[];
  for(let variant=0;variant<5;variant++) {
    const g=new THREE.Group();
    const part=(geometry:THREE.BufferGeometry,color:number,x:number,y:number,z:number)=>{
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color}));mesh.position.set(x,y,z);g.add(mesh);return mesh;
    };
    const ring=(radius:number,tube:number,color:number,y:number)=>{
      const m=part(new THREE.TorusGeometry(radius,tube,5,20),color,0,y,0);m.rotation.x=Math.PI/2;return m;
    };
    if(variant===0) {
      part(new THREE.CylinderGeometry(.29,.35,.48,16),0x795033,0,.24,0);
      part(new THREE.CylinderGeometry(.278,.278,.015,20),0xb58a54,0,.485,0);
      for(const r of [.07,.14,.21]) ring(r,.005,0x8b603b,.496);
      for(let i=0;i<9;i++) {
        const a=i*Math.PI*2/9,x=Math.cos(a),z=Math.sin(a);
        link(g,i%2?0x8d603c:0x684730,[x*.34,.05,z*.34],[x*.285,.44,z*.285],.039,.024);
        const root=ball(g,0x805a39,x*.3,.07,z*.3,.16,.075,.08);root.rotation.y=-a;
      }
      for(let i=0;i<4;i++) ball(g,0x738047,Math.cos(i*2)*.3,.035,Math.sin(i*2)*.3,.1,.025,.065);
    } else if(variant===1) {
      part(new THREE.CylinderGeometry(.29,.23,.37,18,1,true),0xae6245,0,.21,0);
      part(new THREE.CylinderGeometry(.27,.27,.025,18),0x624735,0,.34,0);
      ring(.282,.04,0xc07b57,.395);ring(.235,.027,0x9a543e,.055);
      for(let i=0;i<7;i++) ball(g,i%2?0x75533c:0x8a6548,Math.sin(i*2)*.18,.37,Math.cos(i*2)*.18,.065,.03,.05);
      const shard=part(new THREE.ConeGeometry(.075,.15,3),0xc07b57,.26,.065,.20);shard.rotation.z=.7;
      // Missing rim segment reads as a chip without increasing collision size.
      const chip=part(new THREE.BoxGeometry(.09,.08,.055),0x624735,.20,.39,.18);chip.rotation.y=-.7;
    } else if(variant===2) {
      const pipe=part(new THREE.CylinderGeometry(.13,.13,.61,16),0x615246,0,.18,0);pipe.rotation.z=Math.PI/2;
      for(const x of [-.27,.27]) {
        const flange=part(new THREE.CylinderGeometry(.18,.18,.06,16),0x936348,x,.18,0);flange.rotation.z=Math.PI/2;
        for(let i=0;i<6;i++) ball(g,0x8d6a50,x+(x>0?.036:-.036),.18+Math.sin(i*1.047)*.14,Math.cos(i*1.047)*.14,.023,.023,.023,6);
      }
      part(new THREE.CylinderGeometry(.075,.09,.3,12),0x8b6048,0,.37,0);
      ring(.19,.025,0x74604c,.53);
      for(let i=0;i<4;i++) link(g,0x8a6a50,[0,.53,0],[Math.cos(i*Math.PI/2)*.19,.53,Math.sin(i*Math.PI/2)*.19],.015);
      part(new RoundedBoxGeometry(.42,.065,.33,2,.025),0x716150,0,.045,0);
    } else if(variant===3) {
      for(let row=0;row<2;row++) for(const side of [-1,1]) {
        const bag=part(new RoundedBoxGeometry(.31,.18,.51,3,.07),row?0x9e8b60:0x8e7b55,side*.16,.11+row*.17,0);bag.rotation.y=(row?-.1:.06);
        for(const z of [-.23,.23]) link(g,0xb7a376,[side*.16-.13,.105+row*.17,z],[side*.16+.13,.105+row*.17,z],.007);
      }
    } else {
      part(new RoundedBoxGeometry(.65,.39,.6,2,.035),0xa49b82,0,.205,0);
      for(const x of [-.16,.16]) {
        link(g,0x8a6042,[x,.39,0],[x+.035,.61,.02],.023,.02);
        for(let i=0;i<5;i++) link(g,0x654e3b,[x-.015+i*.006,.42+i*.035,-.01],[x+.026+i*.006,.432+i*.035,.03],.005);
      }
      link(g,0x756f5d,[-.32,.36,.05],[-.325,.23,.12],.008,.007);
      link(g,0x756f5d,[-.325,.23,.12],[-.326,.09,.09],.007,.004);
    }
    const mesh=bakeModel(g),material=mesh.material as THREE.MeshStandardMaterial;
    material.roughness=.85;material.metalness=variant===2?.22:0;
    const positions=mesh.geometry.attributes.position,colors=mesh.geometry.attributes.color;
    for(let v=0;v<positions.count;v++) {
      const grain=.93+.07*Math.sin(positions.getX(v)*87+positions.getY(v)*43+positions.getZ(v)*67);
      colors.setXYZ(v,colors.getX(v)*grain,colors.getY(v)*grain,colors.getZ(v)*grain);
    }
    models.push(mesh);
  }
  return {
    create(variant:number) { return models[variant%models.length].clone(); },
    dispose() { models.forEach(disposeModel); }
  };
}
