export const INITIAL_SWARM = 6;
import type { PARASITES } from "./game-rules";
export const ENEMY_ARRIVAL:Record<keyof typeof PARASITES,number>={worm:0,bug:0,spider:0,slug:30,flea:45,scorpion:60,beetle:90,hornet:90,spitter:120,termite:150,pillbug:150,mosquito:180,eggsac:210,locust:240};
export function explorationPressure(seconds:number){
  return {speed:1+Math.min(1.3,seconds/240),stick:.15+Math.min(.7,seconds/400),bite:1+Math.min(.4,seconds/1200),armor:seconds>=120?1:0,swarm:1+Math.min(1.66,seconds/240)};
}
export function enemyWeights(seconds:number){
  const weights:Partial<Record<keyof typeof PARASITES,number>>={};
  for(const [kind,at] of Object.entries(ENEMY_ARRIVAL))if(seconds>=at)weights[kind as keyof typeof PARASITES]=kind==="worm"?4:kind==="bug"?3:kind==="eggsac"?1:2;
  return weights;
}
