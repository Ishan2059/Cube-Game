import * as THREE from "three";

export function createLandingDust(scene:THREE.Scene) {
  const count=28,particles=Array.from({length:count},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,age:2,life:1,size:0}));
  const positions=new Float32Array(count*18),colors=new Float32Array(count*24),uv=new Float32Array(count*12);
  for(let i=0;i<count;i++)uv.set([0,0,1,0,0,1,1,0,1,1,0,1],i*12);
  const geo=new THREE.BufferGeometry();geo.setAttribute("position",new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute("color",new THREE.BufferAttribute(colors,4).setUsage(THREE.DynamicDrawUsage));geo.setAttribute("uv",new THREE.BufferAttribute(uv,2));
  const canvas=document.createElement("canvas");canvas.width=canvas.height=64;const c=canvas.getContext("2d")!,gradient=c.createRadialGradient(32,32,3,32,32,30);gradient.addColorStop(0,"rgba(255,255,255,.65)");gradient.addColorStop(.5,"rgba(255,255,255,.3)");gradient.addColorStop(1,"transparent");c.fillStyle=gradient;c.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas),material=new THREE.MeshBasicMaterial({map:texture,color:0xb7ac78,vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide});material.forceSinglePass=true;
  const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=3;scene.add(mesh);
  const right=new THREE.Vector3(),up=new THREE.Vector3(),q=new THREE.Quaternion();
  return {
    burst(origin:THREE.Vector3){
      particles.forEach((p,i)=>{const a=i/count*Math.PI*2+(Math.random()-.5)*.2,speed=1.8+Math.random()*1.4;p.x=origin.x+Math.cos(a)*.3;p.z=origin.z+Math.sin(a)*.3;p.y=.045;p.vx=Math.cos(a)*speed;p.vz=Math.sin(a)*speed;p.vy=.3+Math.random()*.5;p.age=0;p.life=.55+Math.random()*.45;p.size=.1+Math.random()*.1;});
    },
    clear(){particles.forEach(p=>p.age=2);mesh.visible=false;},
    update(dt:number,camera:THREE.Camera){
      camera.getWorldQuaternion(q);right.set(1,0,0).applyQuaternion(q);up.set(0,1,0).applyQuaternion(q);let n=0;
      for(const p of particles){p.age+=dt;if(p.age>=p.life)continue;const drag=Math.exp(-2.7*dt);p.vx*=drag;p.vz*=drag;p.vy-=.6*dt;p.x+=p.vx*dt;p.y=Math.max(.04,p.y+p.vy*dt);p.z+=p.vz*dt;
        const size=p.size+p.age*.3,rx=right.x*size,ry=right.y*size,rz=right.z*size,ux=up.x*size*.65,uy=up.y*size*.65,uz=up.z*size*.65;
        positions.set([p.x-rx-ux,p.y-ry-uy,p.z-rz-uz,p.x+rx-ux,p.y+ry-uy,p.z+rz-uz,p.x-rx+ux,p.y-ry+uy,p.z-rz+uz,p.x+rx-ux,p.y+ry-uy,p.z+rz-uz,p.x+rx+ux,p.y+ry+uy,p.z+rz+uz,p.x-rx+ux,p.y-ry+uy,p.z-rz+uz],n*18);
        const fade=Math.pow(1-p.age/p.life,1.4);for(let v=0;v<6;v++)colors.set([1,1,1,fade],n*24+v*4);n++;
      }
      geo.setDrawRange(0,n*6);mesh.visible=n>0;geo.attributes.position.needsUpdate=geo.attributes.color.needsUpdate=true;
    },
    dispose(){scene.remove(mesh);geo.dispose();material.dispose();texture.dispose();},
  };
}
