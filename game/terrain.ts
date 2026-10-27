import * as THREE from "three";
import { makeWorldMaterials } from "./world-materials";
import { roadsNear, housesNear, RARE_GATE, type Realm, type Surface } from "./world-rules";

// Shared procedural art keeps props and terrain in the original grass style.
const textures=new Map<string,THREE.Texture>();
export async function preloadWorldArt(){
  if(textures.size===0)for(const [id,texture] of makeWorldMaterials())textures.set(id,texture);
}
export function worldTexture(id:string){return textures.get(id)??null;}

/** One terrain draw: continuous material boundaries, moving water and eight contact ripples. */
export function createTerrain(scene:THREE.Scene,grass:THREE.Texture){
  const contacts=Array.from({length:8},()=>new THREE.Vector4(0,0,10,0));let cursor=0;
  const uniforms={
    uGrass:{value:grass},uMud:{value:worldTexture("mud")},uStone:{value:worldTexture("stone")},uWood:{value:worldTexture("wood")},uAsh:{value:worldTexture("ash")},
    uRoadX:{value:new Float32Array(3).fill(100000)},uRoadZ:{value:new Float32Array(3).fill(100000)},uHouses:{value:Array.from({length:9},()=>new THREE.Vector4(100000,100000,0,0))},uGate:{value:new THREE.Vector2(RARE_GATE.x,RARE_GATE.z)},
    uTime:{value:0},uRealm:{value:0},uContacts:{value:contacts},uFog:{value:new THREE.Color(0x0c190f)}
  };
  const material=new THREE.ShaderMaterial({uniforms,
    vertexShader:`varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`
      uniform sampler2D uGrass,uMud,uStone,uWood,uAsh;
      uniform float uRoadX[3],uRoadZ[3];uniform vec4 uHouses[9];uniform vec2 uGate;
      uniform float uTime,uRealm; uniform vec3 uFog; uniform vec4 uContacts[8]; varying vec3 vWorld;
      float field(vec2 p){return sin(p.x*.19+sin(p.y*.11)*1.8)+cos(p.y*.17+sin(p.x*.09)*1.3)+sin((p.x+p.y)*.07)*.45;}
      float grain(vec2 p){return fract(sin(dot(floor(p),vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 p=vWorld.xz; float hell=step(1.5,uRealm)*(1.0-step(2.5,uRealm)),cabin=step(2.5,uRealm),mire=step(.5,uRealm)*(1.0-step(1.5,uRealm));
        float threshold=mix(1.3,.55,mire);threshold=mix(threshold,.85,hell);
        float f=field(p),safe=1.0-smoothstep(2.0,3.0,max(abs(p.x),abs(p.y)));
        safe=max(safe,1.0-smoothstep(0.0,.2,max(abs(p.x-uGate.x)-3.5,abs(p.y-uGate.y)-2.5)));
        for(int i=0;i<9;i++){vec2 d=abs(p-uHouses[i].xy);safe=max(safe,(1.0-smoothstep(3.3,3.6,max(d.x,d.y)))*uHouses[i].w);}
        float water=smoothstep(threshold-.09,threshold+.09,f)*(1.0-safe);
        float roadDistance=100000.0;
        for(int i=0;i<3;i++){roadDistance=min(roadDistance,min(abs(p.x-uRoadX[i]),abs(p.y-uRoadZ[i])));}
        float road=1.0-smoothstep(.46,.66,roadDistance);
        vec3 grass=texture2D(uGrass,(p+.5)/8.0).rgb;
        vec3 mud=texture2D(uMud,(p+.5)/8.0).rgb;
        vec3 ash=texture2D(uAsh,(p+.5)/8.0).rgb;
        vec3 wood=texture2D(uWood,(p+.5)/8.0).rgb;
        vec3 stone=texture2D(uStone,(p+.5)/8.0).rgb;
        float bank=smoothstep(threshold-.55,threshold-.03,f)*(1.0-safe);
        float dry=smoothstep(.18,.8,sin(p.x*.17+sin(p.y*.12))*cos(p.y*.14-p.x*.06));
        grass=mix(grass,mud*.9,dry*.48)*( .94+grain(p*28.0)*.12);
        vec3 color=mix(grass,mud,max(bank,mire*.82));color=mix(color,ash,hell);
        float ripple=0.0;vec2 rippleN=vec2(0.0);
        for(int i=0;i<8;i++){
          vec2 delta=p-uContacts[i].xy;float d=length(delta),age=uContacts[i].z;
          float ring=sin((d-age*1.65)*24.0)*exp(-abs(d-age*1.65)*5.0)*max(0.0,1.0-age/1.8)*uContacts[i].w;
          ripple+=ring;rippleN+=delta/max(.04,d)*ring*.17;
        }
        // Broad teal planes and sparse moving highlights, not photoreal caustics.
        float flow=sin(p.x*1.5+p.y*.8+uTime*.75)*cos(p.y*1.9-uTime*.6);
        float glint=smoothstep(.93,.995,flow)*.055;
        float shore=(1.0-smoothstep(threshold+.04,threshold+.23,f))*.06;
        vec3 waterColor=vec3(.034,.112,.091)+vec3(.004,.007,.005)*flow;
        waterColor+=vec3(.17,.29,.20)*(glint+shore)+vec3(.06,.13,.10)*ripple;
        vec3 lava=texture2D(uAsh,p/2.2+vec2(uTime*.004,-uTime*.003)).rgb;
        float heat=smoothstep(.17,.5,lava.r-lava.b*.3+sin(p.x*4.0+uTime)*.03);
        float crust=smoothstep(.2,.65,sin(p.x*2.3+sin(p.y*1.7+uTime*.1))*.5+cos(p.y*2.6+sin(p.x*1.2-uTime*.08))*.3);
        lava=mix(vec3(.85,.075,.006),lava*.35,crust*.88)+vec3(1.0,.25,.015)*heat*.55;
        color=mix(color,mix(waterColor,lava,hell),water);
        color=mix(color,mix(stone,wood,water),road);color=mix(color,wood,cabin);
        float room=1.0-smoothstep(0.0,.18,max(abs(p.x)-4.55,abs(p.y)-3.55));
        color=mix(color,wood,cabin*room);
        float distanceFog=1.0-exp(-pow(length(cameraPosition-vWorld)*.026,2.0));
        color=mix(color,uFog,min(.92,distanceFog));color*=mix(1.0,room,cabin);gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  let lastRegion="";
  function syncWorld(x:number,z:number){
    const region=`${Math.round(x/32)}:${Math.round(z/32)}`;if(region===lastRegion)return;lastRegion=region;
    const roads=roadsNear(x,z);uniforms.uRoadX.value.fill(100000);uniforms.uRoadZ.value.fill(100000);
    roads.vertical.forEach((v,i)=>uniforms.uRoadX.value[i]=v);roads.horizontal.forEach((v,i)=>uniforms.uRoadZ.value[i]=v);
    const houses=housesNear(x,z);uniforms.uHouses.value.forEach((v,i)=>houses[i]?v.set(houses[i].x,houses[i].z-1,0,1):v.set(100000,100000,0,0));
  }
  syncWorld(0,0);
  const geo=new THREE.PlaneGeometry(70,70);geo.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geo,material);mesh.position.y=.012;mesh.frustumCulled=false;scene.add(mesh);
  return {
    setRealm(realm:Realm){uniforms.uRealm.value=({meadow:0,mire:1,cinder:2,cabin:3})[realm];uniforms.uFog.value.setHex(realm==="cinder"?0x210b08:realm==="cabin"?0x000000:realm==="mire"?0x0a1817:0x0c190f);contacts.forEach(c=>c.z=10);},
    contact(x:number,z:number,surface:Surface){if(surface!=="water"&&surface!=="mud")return;contacts[cursor++%contacts.length].set(x,z,0,surface==="water"?1:.2);},
    update(dt:number,x:number,z:number){syncWorld(x,z);uniforms.uTime.value+=dt;contacts.forEach(c=>c.z+=dt);mesh.position.x=Math.round(x/8)*8;mesh.position.z=Math.round(z/8)*8;},
    dispose(){scene.remove(mesh);geo.dispose();material.dispose();}
  };
}
