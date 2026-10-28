import * as THREE from "three";
import { trailTexture } from "./trail-art";

export interface TrailStyle { id: string; color: number }
export interface TrailHandle {
  update(dt:number, worldPos:THREE.Vector3, moving:boolean, camera?:THREE.Camera):void;
  setStyle(style:TrailStyle):void;
  setActive(active:boolean):void;
  clear():void;
  dispose():void;
}
export const TRAIL_LIFE=.8;
export const TRAIL_SPREAD=.36;
const POINTS=96,PARTICLES=32,GROUND_LIFE=2.4;
interface Motion { colors:string[]; width:number; ribbon:number; rise:number; gravity:number; drag:number; life:number; spin:number; flutter:number }
const MOTION:Record<string,Motion>={
  afterburn:{colors:["#f44518","#ffa624","#fff0a4"],width:.3,ribbon:.9,rise:.65,gravity:-.3,drag:2.3,life:.65,spin:1,flutter:.05},
  frostwake:{colors:["#3e8ac7","#8ce2fa","#eaffff"],width:.28,ribbon:.65,rise:.45,gravity:1.7,drag:1.2,life:.8,spin:4,flutter:0},
  "neon-surge":{colors:["#7850ea","#46d3f7","#befff4"],width:.25,ribbon:.8,rise:.08,gravity:0,drag:2,life:.45,spin:0,flutter:.035},
  starfall:{colors:["#7560c6","#b39de4","#ffe5a4"],width:.25,ribbon:.65,rise:.4,gravity:.6,drag:1,life:.95,spin:2,flutter:.08},
  "petal-drift":{colors:["#cb729f","#f3b0cd","#ffe0e8"],width:.25,ribbon:.22,rise:.4,gravity:.25,drag:.8,life:1.1,spin:1.3,flutter:.28},
  "bubble-pop":{colors:["#65aebf","#90e4df","#e4fffb"],width:.3,ribbon:.2,rise:.22,gravity:-.25,drag:1.3,life:1.1,spin:0,flutter:.09},
  "pixel-rush":{colors:["#468b66","#92d25b","#d7ff91"],width:.28,ribbon:.3,rise:.2,gravity:.9,drag:1,life:.7,spin:0,flutter:0},
  "gold-rush":{colors:["#b67e2c","#f4c24f","#ffedb0"],width:.3,ribbon:.6,rise:.55,gravity:1.8,drag:1,life:.85,spin:5,flutter:0},
  "void-rift":{colors:["#32214e","#7550b0","#c49bff"],width:.28,ribbon:.7,rise:.1,gravity:-.05,drag:2.7,life:.8,spin:-2,flutter:.1},
  "rainbow-run":{colors:["#f79aab","#ffdb7d","#a6e5ba","#8eceef","#c8acee"],width:.34,ribbon:.85,rise:.3,gravity:.3,drag:1.2,life:.8,spin:1,flutter:.08},
};
function ribbonTexture(style:Motion,id:string) {
  const artwork=trailTexture(id);if(artwork)return artwork;
  const canvas=document.createElement("canvas");canvas.width=128;canvas.height=256;
  const c=canvas.getContext("2d")!,gradient=c.createLinearGradient(0,0,128,0);
  gradient.addColorStop(0,"transparent");gradient.addColorStop(1,"transparent");
  style.colors.forEach((color,i)=>gradient.addColorStop(.1+i*.8/(style.colors.length-1),color));
  c.fillStyle=gradient;c.fillRect(0,0,128,256);
  c.globalAlpha=.6;c.strokeStyle=style.colors[style.colors.length-1];c.lineWidth=3;
  for(let i=0;i<3;i++){
    c.beginPath();c.moveTo(30+i*26,0);
    if(id==="neon-surge"||id==="frostwake"){for(let y=0;y<=256;y+=32)c.lineTo(30+i*26+(y%64?9:-9),y);}
    else c.bezierCurveTo(10+i*27,85,55+i*22,170,30+i*26,256);
    c.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapT=THREE.RepeatWrapping;return texture;
}
function particleTexture(id:string,style:Motion) {
  const artwork=trailTexture(id,true);if(artwork)return artwork;
  const canvas=document.createElement("canvas");canvas.width=canvas.height=96;
  const c=canvas.getContext("2d")!;c.translate(48,48);
  const fill=c.createRadialGradient(-10,-12,1,0,0,38);
  fill.addColorStop(0,"#fffdf1");fill.addColorStop(.3,style.colors[2]??style.colors[1]);fill.addColorStop(1,style.colors[0]);
  c.fillStyle=fill;c.strokeStyle=style.colors[2]??"#ffffff";c.lineWidth=3;
  c.beginPath();
  if(id==="bubble-pop"){
    c.arc(0,0,33,0,Math.PI*2);c.globalAlpha=.18;c.fill();c.globalAlpha=.9;c.stroke();
    c.lineWidth=5;c.strokeStyle="#eeffff";c.beginPath();c.arc(0,0,26,3.5,4.5);c.stroke();
  } else if(id==="petal-drift"){
    c.moveTo(0,33);c.bezierCurveTo(-48,5,-30,-41,0,-27);c.bezierCurveTo(28,-40,42,4,0,33);c.fill();
    c.strokeStyle="#ffe3ee";c.lineWidth=2;c.beginPath();c.moveTo(0,25);c.quadraticCurveTo(-4,0,1,-22);c.stroke();
  } else if(id==="afterburn"){
    c.moveTo(0,-39);c.bezierCurveTo(8,-10,31,8,23,25);c.bezierCurveTo(10,45,-25,37,-25,12);c.bezierCurveTo(-25,-3,-5,-13,0,-39);c.fill();
  } else if(id==="gold-rush"){
    c.ellipse(0,0,25,33,-.3,0,Math.PI*2);c.fill();c.lineWidth=4;c.stroke();
    c.globalAlpha=.65;c.beginPath();c.ellipse(0,0,17,24,-.3,0,Math.PI*2);c.stroke();
  } else if(id==="pixel-rush"){c.fillRect(-27,-27,54,54);c.fillStyle="#e7ffc0";c.fillRect(-22,-22,44,8);}
  else {
    const points=id==="starfall"?10:8;
    for(let i=0;i<points;i++){const a=i*Math.PI*2/points-Math.PI/2,r=i%2?10:36;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    c.closePath();c.fill();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

/** Continuous indexed ribbon + one billboard particle batch. All storage is fixed. */
export function createTrail(scene:THREE.Scene,initial:TrailStyle):TrailHandle {
  let style=initial,motion=MOTION[style.id]??MOTION.afterburn,active=style.id!=="none",cursor=0,particleCursor=0,accumulator=0,distance=0,serial=0,time=0;
  const points=Array.from({length:POINTS},()=>({x:0,z:0,age:GROUND_LIFE,distance:0}));
  const particles=Array.from({length:PARTICLES},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:10,phase:0,size:0,bounces:0}));
  const ordered=new Uint8Array(POINTS),position=new Float32Array(POINTS*6),color=new Float32Array(POINTS*8),uv=new Float32Array(POINTS*4),index=[];
  for(let i=0;i<POINTS-1;i++){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("color",new THREE.BufferAttribute(color,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("uv",new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(index);
  const material=new THREE.MeshBasicMaterial({map:ribbonTexture(motion,style.id),vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  material.forceSinglePass=true;
  const ribbon=new THREE.Mesh(geometry,material);ribbon.frustumCulled=false;ribbon.renderOrder=2;scene.add(ribbon);
  const pp=new Float32Array(PARTICLES*18),pc=new Float32Array(PARTICLES*24),puv=new Float32Array(PARTICLES*12),pgeo=new THREE.BufferGeometry();
  for(let i=0;i<PARTICLES;i++)puv.set([0,0,1,0,0,1,1,0,1,1,0,1],i*12);
  pgeo.setAttribute("position",new THREE.BufferAttribute(pp,3).setUsage(THREE.DynamicDrawUsage));
  pgeo.setAttribute("color",new THREE.BufferAttribute(pc,4).setUsage(THREE.DynamicDrawUsage));
  pgeo.setAttribute("uv",new THREE.BufferAttribute(puv,2));
  const pmat=new THREE.MeshBasicMaterial({map:particleTexture(style.id,motion),vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  pmat.forceSinglePass=true;
  const sparks=new THREE.Mesh(pgeo,pmat);sparks.frustumCulled=false;sparks.renderOrder=3;scene.add(sparks);
  const residueGeo=geometry.clone(),residueMat=new THREE.MeshBasicMaterial({map:material.map?.clone(),vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,color:style.id==="afterburn"?0x4c2e1a:0xc5d0cf});residueMat.forceSinglePass=true;
  const residue=new THREE.Mesh(residueGeo,residueMat);residue.frustumCulled=false;residue.renderOrder=1;scene.add(residue);
  const last=new THREE.Vector3(Infinity,0,Infinity),right=new THREE.Vector3(1,0,0),up=new THREE.Vector3(0,.8,-.6),quaternion=new THREE.Quaternion();
  function clear(){points.forEach(p=>p.age=GROUND_LIFE);particles.forEach(p=>p.age=10);accumulator=0;distance=0;ribbon.visible=sparks.visible=residue.visible=false;last.set(Infinity,0,Infinity);}
  clear();
  return {
    update(dt,pos,moving,camera){
      dt=Math.max(0,Math.min(dt,.05));time+=dt;
      if(material.map)material.map.offset.y=-time*.14;
      points.forEach(p=>p.age+=dt);
      if(last.x!==Infinity&&Math.hypot(pos.x-last.x,pos.z-last.z)>2)clear();
      if(last.x===Infinity)last.copy(pos);
      const dx=pos.x-last.x,dz=pos.z-last.z,travel=Math.hypot(dx,dz),tx=travel>.0001?dx/travel:1,tz=travel>.0001?dz/travel:0;
      if(active&&moving){
        accumulator+=dt;distance+=travel;
        while(accumulator>=.03){
          accumulator-=.03;
          const f=dt>0?1-accumulator/dt:1,x=last.x+dx*f,z=last.z+dz*f,p=points[cursor];
          p.x=x;p.z=z;p.age=accumulator;p.distance=distance-travel*(1-f);cursor=(cursor+1)%POINTS;
          if(++serial%2===0){
            const q=particles[particleCursor],side=(Math.random()-.5)*2;
            q.x=x-tz*side*.2;q.z=z+tx*side*.2;q.y=.08;q.vx=-tx*.2-tz*side*.35;q.vz=-tz*.2+tx*side*.35;
            q.vy=motion.rise*(.7+Math.random()*.6);q.age=0;q.phase=Math.random()*Math.PI*2;q.size=.13+Math.random()*.08;q.bounces=0;
            particleCursor=(particleCursor+1)%PARTICLES;
          }
        }
      } else accumulator=0;
      last.copy(pos);
      let count=0;
      for(let i=0;i<POINTS;i++){const at=(cursor+i)%POINTS;if(points[at].age<TRAIL_LIFE)ordered[count++]=at;}
      for(let i=0;i<count;i++){
        const p=points[ordered[i]],previous=points[ordered[Math.max(0,i-1)]],next=points[ordered[Math.min(count-1,i+1)]];
        const dx=next.x-previous.x,dz=next.z-previous.z,len=Math.hypot(dx,dz)||1,life=Math.max(0,1-p.age/TRAIL_LIFE),width=.48*Math.pow(life,.4);
        const nx=-dz/len,nz=dx/len;
        const wave=Math.sin(p.distance*3.2-time*5.5)*Math.sin(Math.min(1,p.age/TRAIL_LIFE)*Math.PI)*.2;
        const x=p.x+nx*wave,z=p.z+nz*wave,y=.06+Math.sin(p.age*8+p.distance*2)*.015;
        position.set([x+nx*width,y,z+nz*width,x-nx*width,y,z-nz*width],i*6);
        const fade=Math.min(1,life*4)*(i===0?0:1);
        color.set([1,1,1,fade,1,1,1,fade],i*8);
        uv.set([0,p.distance*.35,1,p.distance*.35],i*4);
      }
      geometry.setDrawRange(0,Math.max(0,count-1)*6);ribbon.visible=count>1;
      geometry.attributes.position.needsUpdate=geometry.attributes.color.needsUpdate=geometry.attributes.uv.needsUpdate=true;
      let groundCount=0;
      for(let i=0;i<POINTS;i++){const at=(cursor+i)%POINTS;if(points[at].age<GROUND_LIFE)ordered[groundCount++]=at;}
      const rp=residueGeo.attributes.position.array as Float32Array,rc=residueGeo.attributes.color.array as Float32Array,ru=residueGeo.attributes.uv.array as Float32Array;
      for(let i=0;i<groundCount;i++){
        const p=points[ordered[i]],a=points[ordered[Math.max(0,i-1)]],b=points[ordered[Math.min(groundCount-1,i+1)]];
        const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;
        rp.set([p.x+nx*.3,.027,p.z+nz*.3,p.x-nx*.3,.027,p.z-nz*.3],i*6);
        const fade=Math.max(0,1-p.age/GROUND_LIFE)*.22*(i===0?0:1);
        rc.set([1,1,1,fade,1,1,1,fade],i*8);ru.set([0,p.distance*.35,1,p.distance*.35],i*4);
      }
      residueGeo.setDrawRange(0,Math.max(0,groundCount-1)*6);residue.visible=groundCount>1;
      residueGeo.attributes.position.needsUpdate=residueGeo.attributes.color.needsUpdate=residueGeo.attributes.uv.needsUpdate=true;
      if(camera){camera.getWorldQuaternion(quaternion);right.set(1,0,0).applyQuaternion(quaternion);up.set(0,1,0).applyQuaternion(quaternion);}
      let n=0;
      for(const p of particles){
        p.age+=dt;if(p.age>=motion.life)continue;
        const drag=Math.exp(-motion.drag*dt);p.vx*=drag;p.vz*=drag;p.vy-=motion.gravity*dt;
        p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
        if(p.y<.035){p.y=.035;p.vy=Math.abs(p.vy)*.28;if(++p.bounces>1)p.vy=0;}
        const life=1-p.age/motion.life,phase=p.phase+p.age*motion.spin;
        let x=p.x+Math.sin(p.phase+p.age*9)*motion.flutter*p.age,z=p.z+Math.cos(p.phase+p.age*7)*motion.flutter*p.age;
        if(style.id==="pixel-rush"){x=Math.round(x*24)/24;z=Math.round(z*24)/24;}
        const grow=style.id==="bubble-pop"?1+p.age*.7:.4+.6*life;
        const size=p.size*grow,sx=style.id==="petal-drift"?size*(.35+.65*Math.abs(Math.cos(p.age*8+p.phase))):size;
        const cos=Math.cos(phase),sin=Math.sin(phase);
        const ax=(right.x*cos+up.x*sin)*sx,ay=(right.y*cos+up.y*sin)*sx,az=(right.z*cos+up.z*sin)*sx;
        const bx=(up.x*cos-right.x*sin)*size,by=(up.y*cos-right.y*sin)*size,bz=(up.z*cos-right.z*sin)*size;
        const y=p.y;
        pp.set([x-ax-bx,y-ay-by,z-az-bz,x+ax-bx,y+ay-by,z+az-bz,x-ax+bx,y-ay+by,z-az+bz,x+ax-bx,y+ay-by,z+az-bz,x+ax+bx,y+ay+by,z+az+bz,x-ax+bx,y-ay+by,z-az+bz],n*18);
        const fade=style.id==="bubble-pop"?Math.min(1,life*5):Math.min(1,life*2);
        const flicker=style.id==="neon-surge"?.55+.45*Math.abs(Math.sin(p.age*70)):1;
        for(let v=0;v<6;v++)pc.set([1,1,1,fade*flicker],n*24+v*4);
        n++;
      }
      pgeo.setDrawRange(0,n*6);sparks.visible=n>0;pgeo.attributes.position.needsUpdate=pgeo.attributes.color.needsUpdate=true;
    },
    setStyle(next){if(next.id===style.id)return;style=next;motion=MOTION[style.id]??MOTION.afterburn;clear();material.map?.dispose();pmat.map?.dispose();material.map=ribbonTexture(motion,style.id);residueMat.map?.dispose();residueMat.map=material.map?.clone()??null;residueMat.color.setHex(style.id==="afterburn"?0x4c2e1a:0xc5d0cf);pmat.map=particleTexture(style.id,motion);},
    setActive(value){active=value;if(!value)clear();},clear,
    dispose(){scene.remove(ribbon,sparks,residue);residueGeo.dispose();residueMat.map?.dispose();residueMat.dispose();geometry.dispose();pgeo.dispose();material.map?.dispose();pmat.map?.dispose();material.dispose();pmat.dispose();}
  };
}
