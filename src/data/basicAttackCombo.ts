/** Multipliers apply after equipment enhancements; weapon IDs and status
 * strength stay intact. The finisher trades stamina and recovery for damage. */
export interface BasicAttackStep {
  readonly name:string;
  readonly damageMultiplier:number;
  readonly staminaMultiplier:number;
  readonly recoveryMultiplier:number;
  readonly coneDot:number;
  readonly impactFraction:number;
  readonly activeMs:number;
  readonly lungeDistance:number;
  readonly reachMultiplier:number;
  readonly frames:readonly number[];
  readonly frameWeights:readonly number[];
}

export const BASIC_ATTACK_CHAIN:readonly BasicAttackStep[]=[
  {name:'Slash',damageMultiplier:1,staminaMultiplier:1,recoveryMultiplier:.72,
    coneDot:.05,impactFraction:.16,activeMs:100,lungeDistance:18,reachMultiplier:1,
    frames:[0,1,2,3,4,5],frameWeights:[1,1,1,1,1,1]},
  {name:'Return slash',damageMultiplier:1.2,staminaMultiplier:1,recoveryMultiplier:.76,
    coneDot:-.12,impactFraction:.22,activeMs:120,lungeDistance:22,reachMultiplier:1.05,
    frames:[5,4,3,2,1,0],frameWeights:[1,1,1,1,1,1]},
  {name:'Heavy cleave',damageMultiplier:1.7,staminaMultiplier:1.5,recoveryMultiplier:1.02,
    coneDot:-.25,impactFraction:.5,activeMs:150,lungeDistance:28,reachMultiplier:1.18,
    frames:[0,1,2,3,4,5],frameWeights:[.12,.38,.1,.12,.14,.14]},
];

/** Time available after recovery to continue with a tap instead of a hold. */
export const BASIC_ATTACK_LINK_MS=700;
export const BASIC_ATTACK_BUFFER_MS=280;

export function basicAttackStamina(baseCost:number,step:BasicAttackStep):number {
  return Math.ceil(baseCost*step.staminaMultiplier);
}
