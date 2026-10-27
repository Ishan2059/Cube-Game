import bank from "./audio-bank.json";
import type { ParasiteType } from "./parasites";

export type AudioCue = keyof typeof bank;
type Voice = { source: AudioBufferSourceNode; gain: GainNode; cue: AudioCue; priority: number };
const MAX_VOICES = 12;
const MAX_BUFFERS = 64;
let context: AudioContext | undefined, master: GainNode | undefined, muted=false, generation=0;
const buffers=new Map<string,AudioBuffer>();
const loading=new Map<string,Promise<AudioBuffer | null>>();
const lastPlayed=new Map<string,number>(), variants=new Map<AudioCue,number>();
const voices: Voice[]=[];
const warm: AudioCue[]=["exploration.roll_grass","exploration.roll_stone","exploration.roll_wood","exploration.roll_mud","exploration.roll_water","exploration.roll_ash","exploration.splash","exploration.water_exit","exploration.bush_rustle","exploration.door_open","exploration.portal_enter","kills.worm","kills.bug","gameplay.crush_impact","gameplay.obstacle_knock",
  "gameplay.parasite_bite","rewards.score_gain_1","rewards.coin_payout","session.start","session.game_over",
  "ui.navigate","ui.back","ui.tab_switch","ui.modal_open","ui.modal_close","shop.purchase","shop.equip_skin","shop.equip_trail"];
let warming=false, inFlight=0, movementEpoch=0;
let movementSurface="";
const isMovement=(cue:string)=>cue.startsWith("exploration.roll_")||["exploration.splash","exploration.water_exit","exploration.bridge_creak","exploration.mud_release","gameplay.cube_roll"].includes(cue);
const jobs: (()=>void)[]=[];
function drain() { while(inFlight<4 && jobs.length) { inFlight++; jobs.shift()!(); } }
function load(stem: string): Promise<AudioBuffer | null> {
  if(buffers.has(stem)) {
    const b=buffers.get(stem)!; buffers.delete(stem);buffers.set(stem,b);return Promise.resolve(b);
  }
  if(loading.has(stem)) return loading.get(stem)!;
  const pending=new Promise<AudioBuffer | null>(resolve=>{
    jobs.push(()=>{ void (async()=>{
      try {
        for(const ext of ["ogg","wav"]) {
          try {
            const response=await fetch(stem+"."+ext); if(!response.ok) continue;
            const bytes=await response.arrayBuffer();
            const decoded=await context!.decodeAudioData(bytes);
            if(buffers.size>=MAX_BUFFERS) buffers.delete(buffers.keys().next().value!);
            buffers.set(stem,decoded);resolve(decoded);return;
          } catch { /* Safari/older browser codec fallback; sound is optional. */ }
        }
        resolve(null);
      } finally { loading.delete(stem);inFlight--;drain(); }
    })(); });
  });
  loading.set(stem,pending);drain();return pending;
}
/** Only call from a user gesture; game events never try to bypass autoplay. */
export function audio(): AudioContext {
  if(!context) {
    context=new AudioContext();
    master=context.createGain();master.gain.value=muted?0:.72;
    const limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=6;
    master.connect(limiter);limiter.connect(context.destination);
  }
  if(context.state==="suspended") void context.resume().catch(()=>{});
  if(!warming) { warming=true;warm.forEach(cue=>void load(bank[cue].files[0])); }
  return context;
}
function release(voice: Voice) {
  const index=voices.indexOf(voice);if(index>=0) voices.splice(index,1);
  voice.source.disconnect();voice.gain.disconnect();
}
export function stopAudio() {
  generation++;
  for(const voice of [...voices]) { voice.source.onended=null;try {voice.source.stop();} catch {} release(voice); }
}
export function setMuted(value: boolean) {
  muted=value;
  if(master && context) master.gain.setValueAtTime(value?0:.72,context.currentTime);
  if(value) stopAudio();
}
export function playCue(cue: AudioCue, volume=1) {
  if(muted||!context||context.state!=="running"||document.hidden) return;
  const config=bank[cue],now=performance.now(),family=cue.startsWith("kills.")?"kills":cue.startsWith("rewards.score_gain")?"score":cue;
  if(now-(lastPlayed.get(family)??-Infinity)<config.cooldownMs) return;
  lastPlayed.set(family,now);
  const n=variants.get(cue)??0;variants.set(cue,n+1);
  const stem=config.files[n%config.files.length],epoch=generation,motionEpoch=movementEpoch;
  const start=(buffer: AudioBuffer | null)=>{
    if(!buffer||muted||epoch!==generation||isMovement(cue)&&motionEpoch!==movementEpoch||!context||context.state!=="running"||document.hidden||performance.now()-now>180) return;
    if(voices.filter(v=>v.cue===cue).length>=config.maxVoices) return;
    if(voices.length>=MAX_VOICES) {
      const quietest=voices.reduce((a,b)=>a.priority<=b.priority?a:b);
      if(quietest.priority>config.priority) return;
      quietest.source.stop();release(quietest);
    }
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=buffer;gain.gain.value=volume;
    source.connect(gain);gain.connect(master!);
    const voice={source,gain,cue,priority:config.priority};
    voices.push(voice);source.onended=()=>release(voice);source.start();
  };
  const cached=buffers.get(stem);
  if(cached) start(cached); else void load(stem).then(start);
  // Prepare the next variant without delaying the current event.
  if(config.files.length>1) void load(config.files[(n+1)%config.files.length]);
}
export const playSplat=(type?:ParasiteType)=>playCue(type ? `kills.${type}` : "kills.generic");
export const playKnock=()=>playCue("gameplay.obstacle_knock");
export const playLatch=()=>playCue("gameplay.parasite_latch");
export const playHurt=()=>playCue("gameplay.player_hurt");
export const playBite=()=>playCue("gameplay.parasite_bite");
export const playHeal=()=>playCue("powerups.heal");
export const playCoin=()=>playCue("rewards.coin_payout");
export const playSpit=()=>playCue("hazards.acid_spit");
export const playRampage=()=>playCue("powerups.rampage_start");
export function playScore(combo:number) {
  playCue(`rewards.score_gain_${Math.min(8,Math.max(1,combo))}` as AudioCue,.5);
}

/** The destination owns landing foley; only crossing the shoreline gets a large splash. */
export function playSurfaceRoll(surface: import("./world-rules").Surface, previous?:import("./world-rules").Surface) {
  if(surface!==movementSurface){
    movementSurface=surface;movementEpoch++;
    for(const voice of [...voices])if(isMovement(voice.cue)){
      if(context){
        voice.gain.gain.setValueAtTime(voice.gain.gain.value,context.currentTime);
        voice.gain.gain.linearRampToValueAtTime(0,context.currentTime+.012);
        try{voice.source.stop(context.currentTime+.012);}catch{release(voice);}
      }
    }
  }
  const key=surface==="lava"?"ash":surface;
  if(surface==="water"&&previous!=="water")playCue("exploration.splash",.65);
  else playCue(`exploration.roll_${key}`,surface==="water"?.58:surface==="wood"?.3:.28);
  if(previous==="water"&&surface!=="water")playCue("exploration.water_exit",.32);
}
