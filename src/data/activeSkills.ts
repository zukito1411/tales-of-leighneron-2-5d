export type ActiveSkillId = 'azure-cleave' | 'skyfall-slam' | 'crown-rally' | 'crescent-flurry' | 'ember-cleave' | 'iron-tempest' | 'renewing-light' | 'barrage';
export type ActiveSkillAction = 'skill1' | 'skill2' | 'skill3' | 'skill4';
export type PlayerSkillTexture = 'skill_azure_cleave' | 'skill_skyfall_slam' | 'skill_crown_rally' | 'skill_crescent_flurry' | 'skill_ember_snare' | 'skill_iron_rush' | 'skill_iron_rush_up' | 'skill_iron_rush_down';

export interface ActiveSkillDefinition {
  id:ActiveSkillId; name:string; slot:1 | 2 | 3 | 4; action:ActiveSkillAction; texture:PlayerSkillTexture; minLevel:number;
  description:string; kind:'strike' | 'rally'; staminaCost:number; cooldownMs:number; durationMs:number;
  radius:number; coneDot:number; hitTimes:readonly number[]; damageMultipliers:readonly number[];
  targetingRange?:number;
  learnCost?:number; animationId?:ActiveSkillId; healingFraction?:number;
  poseTimes?:readonly number[]; hideWeapon?:boolean;
}

// Original arts retain automatic level unlocks. Purchased combat arts and
// passive talents are tracked separately, preserving existing progression.
const starterArts:readonly ActiveSkillDefinition[] = [
  { id:'azure-cleave',name:'Azure Cleave',minLevel:5,slot:1,action:'skill1',texture:'skill_azure_cleave',
    description:'Launch a long-range energy slash at your selected enemy, or the nearest visible foe, for double weapon damage.',kind:'strike',staminaCost:18,cooldownMs:4500,durationMs:600,targetingRange:620,
    radius:112,coneDot:-.25,hitTimes:[280],damageMultipliers:[2] },
  { id:'skyfall-slam',name:'Skyfall Slam',minLevel:10,slot:2,action:'skill2',texture:'skill_skyfall_slam',
    description:'Leap toward your selected enemy and slam their position from a safe landing, dealing 2.8× weapon damage nearby.',kind:'strike',staminaCost:28,cooldownMs:8500,durationMs:850,targetingRange:360,
    radius:150,coneDot:-1,hitTimes:[570],damageMultipliers:[2.8] },
  { id:'crown-rally',name:'Crown Rally',minLevel:5,slot:3,action:'skill3',texture:'skill_crown_rally',
    description:'Recover 20% maximum health and take 50% less damage for 5 seconds.',kind:'rally',staminaCost:24,cooldownMs:16000,durationMs:600,
    radius:0,coneDot:-1,hitTimes:[300],damageMultipliers:[] },
  { id:'crescent-flurry',name:'Crescent Flurry',minLevel:15,slot:4,action:'skill4',texture:'skill_crescent_flurry',
    description:'Unleash ten sweeping slashes over four seconds, staggering nearby enemies in all directions and interrupting their attacks throughout the flurry.',kind:'strike',staminaCost:22,cooldownMs:6500,durationMs:4000,
    radius:104,coneDot:-1,hitTimes:[200,600,1000,1400,1800,2200,2600,3000,3400,3800],
    damageMultipliers:[.25,.25,.25,.25,.25,.25,.25,.25,.25,.25] },
];
const additional:ActiveSkillDefinition[]=[
  {id:'barrage',name:'Barrage',slot:4,action:'skill4',texture:'skill_iron_rush',minLevel:60,poseTimes:[0],
    description:'Blink between up to six nearby foes, delivering twelve rapid slashes at 1.25 times weapon damage each. Invulnerable throughout the barrage. Walls block blinking. Unlocks automatically at level 60 after breakthrough.',kind:'strike',staminaCost:50,cooldownMs:36000,durationMs:2400,targetingRange:560,radius:90,coneDot:-1,
    hitTimes:[150,330,510,690,870,1050,1230,1410,1590,1770,1950,2130],damageMultipliers:[1.25,1.25,1.25,1.25,1.25,1.25,1.25,1.25,1.25,1.25,1.25,1.25]},
  {id:'ember-cleave',name:'Ember Snare',slot:1,action:'skill1',texture:'skill_ember_snare',minLevel:18,learnCost:2,poseTimes:[0,120,260,420,600,820],hideWeapon:true,
    description:'Erupt beneath your selected foe. Enemies caught in the ember field are rooted for its remaining 2.6-second duration and struck by three delayed eruptions. Rooted enemies can still attack.',kind:'strike',staminaCost:30,cooldownMs:9000,durationMs:1000,targetingRange:320,radius:86,coneDot:-1,hitTimes:[600],damageMultipliers:[1.1]},
  {id:'iron-tempest',name:'Iron Rush',slot:2,action:'skill2',texture:'skill_iron_rush',minLevel:22,learnCost:3,poseTimes:[0,100,220,350,450,560],
    description:'Rush to your selected enemy, stopping short to deliver a heavy frontal sword thrust for 3 times weapon damage. Walls stop the rush. Without a target, rush up to 160 pixels in your facing direction.',kind:'strike',staminaCost:36,cooldownMs:11000,durationMs:650,targetingRange:240,radius:90,coneDot:.4,hitTimes:[500],damageMultipliers:[3]},
  {id:'renewing-light',name:'Renewing Light',slot:3,action:'skill3',texture:'skill_crown_rally',animationId:'crown-rally',minLevel:20,learnCost:2,
    description:'Restore 6% maximum health each second for six seconds. Taking a hit interrupts the remaining healing; grants no damage protection.',kind:'rally',staminaCost:38,cooldownMs:24000,durationMs:600,radius:0,coneDot:-1,hitTimes:[300],damageMultipliers:[]},
];
// Keep definitions immutable to callers while exposing one catalog.
export const ACTIVE_SKILLS:readonly ActiveSkillDefinition[]=[...starterArts,...additional];
export const DEFAULT_SKILL_SLOTS:ActiveSkillId[]=['azure-cleave','skyfall-slam','crown-rally','crescent-flurry'];
export function slottedActiveSkills(slots:readonly (ActiveSkillId|null)[]){
  return slots.flatMap((id,index)=>id&&ACTIVE_SKILL_BY_ID[id]?[{...ACTIVE_SKILL_BY_ID[id],slot:(index+1) as 1|2|3|4,action:`skill${index+1}` as ActiveSkillAction}]:[]);
}
export const ACTIVE_SKILL_BY_ID = Object.fromEntries(ACTIVE_SKILLS.map(skill => [skill.id,skill])) as Record<ActiveSkillId,ActiveSkillDefinition>;

export interface ActiveSkillStatus {
  cooldowns:Record<ActiveSkillId,number>; casting:ActiveSkillId | null; rallyRemaining:number;
}
export function initialActiveSkillStatus():ActiveSkillStatus {
  return { cooldowns:Object.fromEntries(ACTIVE_SKILLS.map(s=>[s.id,0])) as Record<ActiveSkillId,number>,casting:null,rallyRemaining:0 };
}
