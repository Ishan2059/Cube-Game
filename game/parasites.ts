import * as THREE from "three";
import { PARASITES } from "@/lib/game-rules";
import { bakeModel, ball, link } from "./model";
export const TYPES = PARASITES;
export type ParasiteType = keyof typeof TYPES;
export type ParasiteDef = (typeof TYPES)[ParasiteType];

/** Articulated authoring rig, baked into one skinned draw call per creature. */
export function makeParasiteMesh(type: ParasiteType, demonic = false): THREE.Group {
  const rig=new THREE.Group();
  const legs: {group:THREE.Group;phase:number;side:number}[]=[];
  const wings: THREE.Mesh[]=[];
  const segments: {mesh:THREE.Mesh;y:number;x:number;sy:number}[]=[];
  const orb=(color:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx,detail=16)=>ball(rig,color,x,y,z,sx,sy,sz,Math.max(detail,12));
  function eyes(x:number,y:number,spread:number,size=.034,red=false) {
    red ||= demonic;
    for(const side of [-1,1]) {
      orb(red?0x9d183f:0xfff2ce,x,y,side*spread,size*.7,size*1.25,size,16);
      if(!red) orb(0x17272a,x+size*.74,y,side*spread,size*.24,size*.82,size*.68,14);
      orb(0xffffff,x+size*.99,y+size*.3,side*spread-size*.22,size*.15,size*.2,size*.18,6);
    }
  }
  function limb(parent:THREE.Group,color:number,a:number[],b:number[],radius:number){
    const start=new THREE.Vector3(...a as [number,number,number]),end=new THREE.Vector3(...b as [number,number,number]),delta=end.clone().sub(start),center=start.clone().add(end).multiplyScalar(.5);
    const m=ball(parent,color,center.x,center.y,center.z,radius,delta.length()*.57,radius,12);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  function legPairs(count:number,color:number,length=.2,thickness=.018,start=.1,step=.09) {
    for(let i=0;i<count;i++) for(const side of [-1,1]) {
      const g=new THREE.Group();g.position.set(start-i*step,.12,side*.07);rig.add(g);
      const reach=(i-(count-1)/2)*-.045;
      limb(g,color,[0,0,0],[reach,.04,side*length*.64],thickness*1.4);
      limb(g,color,[reach,.04,side*length*.64],[reach-.035,-.105,side*length],thickness*.85);
      legs.push({group:g,phase:i*1.9+(side>0?Math.PI:0),side});
    }
  }
  function antenna(x:number,y:number,z:number,color:number,long=.13) {
    for(const side of [-1,1]) {
      link(rig,color,[x,y,z+side*.035],[x+.045,y+long*.6,z+side*.075],.008,.006);
      link(rig,color,[x+.045,y+long*.6,z+side*.075],[x+.09,y+long,z+side*.095],.006,.003);
    }
  }
  function wing(x:number,y:number,z:number,side:number,color=0xc3dfd6) {
    const w=orb(color,x,y,z,.17,.008,.055,12);w.rotation.y=side*.5;wings.push(w);
  }
  if(type==="worm"||type==="slug") {
    const slug=type==="slug",colors=slug?[0xa9b73b,0x8a9b31]:[0xb8db4b,0x43834b];
    for(let i=0;i<5;i++) {
      const r=slug?.14-i*.018:.145-i*.021,x=-i*.105,y=slug?r*.56:r*.92;
      const m=orb(colors[i%2],x,y,0,r*(slug?1.4:1.05),r*(slug?.57:1),r,24);
      segments.push({mesh:m,y,x,sy:m.scale.y});
    }
    if(slug) {
      orb(0xc3cc65,.04,.13,0,.11,.14,.10,14);
      for(const side of [-1,1]) {
        link(rig,0xa7b957,[.055,.17,side*.045],[.11,.34,side*.085],.016,.012);
        orb(0xc6d36e,.11,.345,side*.085,.03,.034,.03,10);
        orb(0x263722,.129,.351,side*.085,.018,.022,.024,8);
      }
      for(let i=0;i<4;i++)orb(0x788f2e,-.10-i*.065,.095-i*.012,.04,.025,.008,.018,8);
    } else eyes(.119,.17,.065,.047);
  } else if(type==="eggsac") {
    orb(0x858557,-.025,.025,0,.22,.025,.18);
    for(let i=0;i<7;i++) {
      const a=i*2.4,r=i===6?0:.13,x=Math.cos(a)*r,z=Math.sin(a)*r,y=i===6?.15:.105;
      const m=orb(i%2?0xeee8b1:0xf7f2cb,x,y,z,.075,.105,.075,12);
      segments.push({mesh:m,y,x,sy:m.scale.y});
      orb(0xb9d67a,x+.05,y,z+.018,.024,.04,.025,8);
    }
  } else if(type==="spider") {
    orb(0x6d398c,-.11,.19,0,.19,.175,.17,16);
    orb(0x9352b4,-.14,.322,-.025,.09,.018,.08,12);
    orb(0x784196,.11,.13,0,.105,.105,.115,16);
    eyes(.198,.15,.055,.043,true);
    legPairs(4,0x633179,.25,.029,.10,.065);
    for(const side of [-1,1]) link(rig,0x8c51a8,[.19,.1,side*.05],[.25,.028,side*.055],.025,.004);
  } else if(type==="scorpion") {
    orb(0xbc4935,-.04,.115,0,.2,.09,.115,16);
    for(let i=0;i<3;i++) orb(0xcf5841,-.16+i*.09,.18,0,.055,.025,.1);
    orb(0x9b4735,.13,.11,0,.09,.07,.095);
    eyes(.20,.145,.045,.023);
    legPairs(4,0x8b412f,.19,.018,.1,.07);
    for(const side of [-1,1]) {
      link(rig,0x9e4833,[.12,.1,side*.09],[.27,.13,side*.18],.026,.035);
      orb(0xb62f35,.31,.13,side*.18,.085,.045,.055);
      link(rig,0xb62f35,[.34,.13,side*.21],[.42,.13,side*.18],.023,.002);
      link(rig,0xb62f35,[.34,.13,side*.15],[.41,.13,side*.17],.02,.002);
    }
    const tail=[[-.2,.13,0],[-.29,.21,0],[-.32,.33,0],[-.26,.43,0],[-.14,.46,0],[-.07,.38,0]];
    tail.slice(1).forEach((p,i)=>{link(rig,0xc14732,tail[i],p,.035-i*.004,.03-i*.004);orb(0xde6540,...p as [number,number,number],.032-i*.004);});
    link(rig,0x4d352c,tail[5],[.005,.31,0],.022,.001);
  } else if(type==="pillbug") {
    orb(0x544f49,-.03,.12,0,.22,.12,.145,16);
    for(let i=0;i<6;i++) orb(i%2?0x8e8275:0xa59787,-.2+i*.065,.13,0,.044,.125,.15,12);
    orb(0x7a7065,.2,.085,0,.065,.07,.09);
    eyes(.252,.10,.043,.021);legPairs(6,0x695e52,.14,.01,.17,.065);
  } else if(type==="spitter") {
    orb(0x699740,-.07,.15,0,.20,.14,.16,16);
    orb(0x94b751,.10,.14,0,.11,.09,.12);
    orb(0xc6d768,.06,.09,0,.115,.065,.12);
    link(rig,0x7b9c42,[.13,.13,0],[.31,.14,0],.065,.075);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(.066,.014,6,16),new THREE.MeshStandardMaterial({color:0xa9c55c}));
    lip.rotation.y=Math.PI/2;lip.position.set(.315,.14,0);rig.add(lip);
    orb(0x314b25,.307,.14,0,.005,.052,.052);
    eyes(.13,.245,.075,.032);
    legPairs(2,0x5f8534,.17,.025,.12,.25);
    for(let i=0;i<4;i++) orb(0x9fbe58,-.20+i*.08,.27,Math.sin(i)*.06,.027,.022,.027,8);
  } else {
    const colors: Record<string,number[]> = {
      bug:[0xe35d2b,0x4b352b],beetle:[0x168956,0x293c32],termite:[0xeee0b8,0xb56a25],
      hornet:[0xdca634,0x3e3528],mosquito:[0x96714e,0x594737],flea:[0x9c5b39,0x663d2a],locust:[0x8b9b44,0x52642c]
    };
    const [shell,dark]=colors[type];
    const flying=type==="hornet"||type==="mosquito",y=flying?.25:.14;
    if(type==="hornet") {
      for(let i=0;i<5;i++) orb(i%2?dark:shell,-.23+i*.052,y,0,.047,.075-i*.004,.075-i*.004);
      link(rig,dark,[-.24,y,0],[-.36,y-.025,0],.023,.001);
      orb(dark,.035,y,0,.08,.075,.085);
    } else if(type==="flea") {
      orb(shell,-.07,.19,0,.145,.18,.105,16);
      for(let i=0;i<3;i++) orb(0xb27949,-.14+i*.065,.29,0,.022,.04,.09);
    } else if(type==="termite") {
      for(let i=0;i<4;i++) orb(shell,-.2+i*.07,.11,0,.063,.075,.085);
      orb(dark,.12,.13,0,.10,.09,.09);
    } else {
      if(type!=="bug"&&type!=="beetle")orb(shell,-.07,y,0,type==="locust"?.22:.17,type==="mosquito"?.055:.12,type==="mosquito"?.05:.14,16);
      if(type==="bug"||type==="beetle") {
        orb(shell,-.09,y+.04,0,.24,.18,.17,24);
        for(let i=0;i<8;i++){
          const a=-.30+i*.052,b=a+.052;
          const top=(x:number)=>y+.043+.18*Math.sqrt(Math.max(0,1-((x+.09)/.24)**2));
          link(rig,dark,[a,top(a),0],[b,top(b),0],.004);
        }

      }
      orb(dark,.14,y-.005,0,.105,.095,.11);
    }
    eyes(.22,y+.025,.06,type==="mosquito"?.028:.043,false);
    antenna(.16,y+.05,0,dark,type==="locust"?.18:.1);
    legPairs(3,dark,type==="mosquito"?.25:.18,type==="mosquito"?.009:.024,.11,.09);
    if(type==="beetle") {
      link(rig,dark,[.20,y+.03,0],[.32,y+.15,0],.06,.034);
      link(rig,dark,[.32,y+.15,0],[.31,y+.32,0],.034,.002);
    }
    if(type==="termite") for(const side of [-1,1]) link(rig,dark,[.2,.1,side*.05],[.27,.085,side*.02],.02,.001);
    if(flying) for(const side of [-1,1]) wing(-.035,y+.06,side*.13,side);
    if(type==="mosquito") link(rig,dark,[.18,y,0],[.36,y-.035,0],.01,.002);
    if(type==="locust"||type==="flea") for(const side of [-1,1]) {
      link(rig,shell,[-.12,.13,side*.09],[-.22,.26,side*.17],.04,.035);
      link(rig,dark,[-.22,.26,side*.17],[-.27,.02,side*.25],.018,.005);
    }
  }
  rig.userData.animate=(t:number)=>{
    for(const l of legs) {l.group.rotation.y=Math.sin(t*13+l.phase)*.19;l.group.rotation.x=Math.sin(t*13+l.phase)*.09;}
    wings.forEach((w,i)=>w.rotation.x=(i%2?1:-1)*(.2+Math.sin(t*60)*.55));
    segments.forEach(({mesh,y,x,sy},i)=>{
      const wave=Math.sin(t*(type==="eggsac"?3:7)-i*.8);
      mesh.position.y=y+Math.max(0,wave)*.013;
      mesh.position.x=x+(type==="eggsac"?0:wave*.01);mesh.scale.y=sy*(1+wave*.035);
    });
  };
  if(demonic){
    rig.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(0x641c16),.36);});
    const bounds=new THREE.Box3().setFromObject(rig),y=bounds.max.y*.76;
    for(const side of [-1,1]){
      link(rig,0x35262b,[.08,y,side*.07],[.12,y+.12,side*.14],.035,.022);
      link(rig,0xb85a35,[.12,y+.12,side*.14],[.19,y+.22,side*.16],.022,.001);
    }
    for(let i=0;i<3;i++)link(rig,0x9d3822,[-.02-i*.07,y*.8,0],[-.07-i*.07,y*.8+.11,0],.028,.001);
  }
  const mesh=bakeModel(rig,true),group=new THREE.Group();group.add(mesh);
  group.userData.demonic=demonic;
  const chitin=mesh.material as THREE.MeshStandardMaterial;
  chitin.roughness=type==="beetle"?.24:type==="slug"||type==="eggsac"?.3:.38;
  chitin.metalness=type==="beetle"?.32:.04;
  chitin.envMapIntensity=.85;
  if(demonic){const material=mesh.material as THREE.MeshStandardMaterial;material.emissive.setHex(0x82220c);material.emissiveIntensity=.16;}
  group.userData.animate=mesh.userData.animate;
  return group;
}
