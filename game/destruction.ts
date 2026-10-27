import * as THREE from "three";

/** Fixed pool: tumbling fragments bounce, lose momentum and shrink into the ground. */
export function createDebris(scene:THREE.Scene){
  const geometry=new THREE.BoxGeometry(1,1,1);
  const material=new THREE.MeshStandardMaterial({roughness:.9,vertexColors:false});
  const mesh=new THREE.InstancedMesh(geometry,material,80);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);
  const pieces=Array.from({length:80},()=>({p:new THREE.Vector3(),v:new THREE.Vector3(),r:new THREE.Vector3(),spin:new THREE.Vector3(),age:4,size:0,color:new THREE.Color()}));
  const dummy=new THREE.Object3D();let cursor=0;
  return {
    burst(x:number,z:number,variant:number){
      const colors=[0x9f7547,0xc57850,0x88634c,0xb3a17b,0x8d9584];
      for(let i=0;i<12;i++){
        const p=pieces[cursor++%pieces.length],angle=Math.random()*Math.PI*2,speed=1+Math.random()*1.8;
        p.p.set(x+(Math.random()-.5)*.4,.25+Math.random()*.3,z+(Math.random()-.5)*.4);
        p.v.set(Math.cos(angle)*speed,1.8+Math.random()*2,Math.sin(angle)*speed);
        p.spin.set(Math.random()*9-4.5,Math.random()*9-4.5,Math.random()*9-4.5);
        p.r.set(0,0,0);p.age=0;p.size=.065+Math.random()*.1;p.color.setHex(colors[variant]);
      }
    },
    update(dt:number){let n=0;
      for(const p of pieces){
        p.age+=dt;if(p.age>=1.8)continue;
        p.v.y-=10*dt;p.p.addScaledVector(p.v,dt);p.r.addScaledVector(p.spin,dt);
        if(p.p.y<p.size*.4){p.p.y=p.size*.4;p.v.y=Math.abs(p.v.y)*.3;p.v.x*=.65;p.v.z*=.65;p.spin.multiplyScalar(.65);}
        dummy.position.copy(p.p);dummy.rotation.set(p.r.x,p.r.y,p.r.z);
        dummy.scale.set(p.size,p.size*.65,p.size*.8).multiplyScalar(Math.min(1,(1.8-p.age)*3));
        dummy.updateMatrix();mesh.setMatrixAt(n,dummy.matrix);mesh.setColorAt(n++,p.color);
      }
      mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    },
    clear(){pieces.forEach(p=>p.age=4);mesh.count=0;},
    dispose(){scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();}
  };
}
