import type {ActiveSkillId} from '../../data/activeSkills';

/** Grip-space transforms for the first-person blade. */
export interface FirstPersonPose {x:number;y:number;z:number;rx:number;ry:number;rz:number}
type Key=readonly [time:number,x:number,y:number,z:number,rx:number,ry:number,rz:number];
const IDLE:Key=[0,.34,-.33,-.9,-.42,-.18,.22];
const REST:readonly Key[]=[IDLE];
const END=(time:number):Key=>[time,IDLE[1],IDLE[2],IDLE[3],IDLE[4],IDLE[5],IDLE[6]];
const CASTS:Partial<Record<ActiveSkillId,readonly Key[]>>={
  'azure-cleave':[IDLE,[140,.51,-.18,-.78,-.25,.2,-.75],[280,-.24,-.24,-1.08,-.75,-.25,1.15],END(600)],
  'skyfall-slam':[IDLE,[140,.22,.04,-.72,.3,.05,-.15],[450,.2,.09,-.72,.4,.05,-.1],[570,.12,-.48,-1.05,-1.6,0,.4],END(850)],
  'iron-tempest':[IDLE,[100,.4,-.25,-.8,-.8,-.1,.1],[350,.12,-.19,-1.1,-1.35,0,0],[500,.05,-.12,-1.45,-1.4,0,0],END(650)],
  'crown-rally':[IDLE,[180,.08,-.16,-.82,-.1,0,0],[300,.08,-.1,-.82,-.1,0,0],END(600)],
  'renewing-light':[IDLE,[180,.16,-.12,-.88,-.2,0,.15],[300,.16,-.06,-.88,-.2,0,.15],END(600)],
  'ember-cleave':[IDLE,[260,.3,-.27,-.8,.05,0,-.1],[600,.06,-.08,-1.08,.15,0,-.15],[820,.08,-.1,-1.04,.1,0,-.1],END(1000)],
};
const FLURRY:readonly Key[]=[IDLE,[110,.5,-.12,-.8,-.3,.1,-.7],[200,-.25,-.26,-1.05,-.8,-.15,1.1],END(400)];
const BARRAGE:readonly Key[]=[IDLE,[55,.47,-.1,-.78,-.25,.15,-.8],[90,-.18,-.2,-1.18,-1.05,0,.9],END(180)];
// Wind up, cross the hit point, follow through, then recover. Returning along
// the same sine curve made the blade reverse precisely when damage landed.
const MELEE:readonly (readonly Key[])[]=[
  [IDLE,[100,.49,-.10,-.8,-.1,.16,-.85],[190,.12,-.24,-1.08,-.7,-.12,.55],[280,-.2,-.42,-.99,-.9,-.2,1.35],END(600)],
  [IDLE,[100,-.26,-.16,-.82,-.25,-.16,.95],[190,.12,-.23,-1.08,-.7,.1,-.45],[280,.52,-.34,-1,-.85,.2,-1.15],END(600)],
  [IDLE,[100,.26,.12,-.76,.35,0,-.12],[190,.12,-.22,-1.08,-.95,0,.1],[280,.04,-.48,-1.12,-1.55,0,.2],END(600)],
];
function sample(out:FirstPersonPose,keys:readonly Key[],time:number,reverse=false){
  let a=keys[0],b=a;
  for(let i=1;i<keys.length;i++){b=keys[i];if(time<=b[0])break;a=b;}
  const linear=Math.max(0,Math.min(1,(time-a[0])/Math.max(1,b[0]-a[0]))),t=linear*linear*(3-2*linear);
  out.x=a[1]+(b[1]-a[1])*t;out.y=a[2]+(b[2]-a[2])*t;out.z=a[3]+(b[3]-a[3])*t;
  out.rx=a[4]+(b[4]-a[4])*t;out.ry=a[5]+(b[5]-a[5])*t;out.rz=a[6]+(b[6]-a[6])*t;
  if(reverse){out.x=IDLE[1]-(out.x-IDLE[1]);out.rz=IDLE[6]-(out.rz-IDLE[6]);}
}
export function firstPersonPose(out:FirstPersonPose,id?:ActiveSkillId,elapsed=0){
  if(id==='crescent-flurry'||id==='barrage'){
    if(id==='barrage'&&elapsed>=2220){sample(out,REST,0);return;}
    const period=id==='barrage'?180:400,first=id==='barrage'?150:200;
    const clock=elapsed-first+period/2;
    if(clock<0)sample(out,REST,0);
    else sample(out,id==='barrage'?BARRAGE:FLURRY,clock%period,Math.floor(clock/period)%2===1);
  }else sample(out,id?CASTS[id]??REST:REST,elapsed);
}

/** Maps the same authoritative impact/active window as the real melee hit. */
export function firstPersonMeleePose(out:FirstPersonPose,step:number,progress:number,impact:number,activeFraction:number){
  const p=Math.max(0,Math.min(1,progress)),wind=impact*.45,finish=Math.min(.82,impact+Math.max(.12,activeFraction));
  const clock=p<wind?p/Math.max(.001,wind)*100:p<impact?100+(p-wind)/Math.max(.001,impact-wind)*90
    :p<finish?190+(p-impact)/Math.max(.001,finish-impact)*90:280+(p-finish)/Math.max(.001,1-finish)*320;
  sample(out,MELEE[Math.max(0,Math.min(2,step))],clock);
}
