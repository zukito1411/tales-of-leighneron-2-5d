import type {ArtTextureKey} from './art';
import {HERO_BODY_HEIGHT} from './heroBodyRegistration';

export type Point=readonly [number,number];
export type Patch=readonly [number,number,number,number];
interface Tier {left:number;right:number;top:number;bottom:number;patch?:Patch}
export interface HouseProfile {
  id:string;roof:readonly Point[];wall:Patch;tiles:Patch;depth:number;
  opening?:readonly Point[];tiers?:readonly Tier[];hip?:{left:number;right:number;eave:number;peak:number};
  curtain?:boolean;board?:boolean;
}
// Visual depth is an authored proportion of visible width. Collision strips
// describe feet in the old painting; they are not a building's physical depth.
export const house=(id:string,roof:readonly Point[],wall:Patch,tiles:Patch,depth=.70):HouseProfile=>({id,roof,wall,tiles,depth});
export const tower=(id:string,wall:Patch,tiles:Patch,tiers:readonly Tier[],hip?:HouseProfile['hip']):HouseProfile=>({
  id,roof:[],wall,tiles,depth:.76,tiers,hip,
});
const arch=(id:string,roof:readonly Point[],opening:readonly Point[],wall:Patch,tiles=wall,depth=.30):HouseProfile=>({
  ...house(id,roof,wall,tiles,depth),opening,
});
const curtain=(id:string,wall:Patch,tiles:Patch):HouseProfile=>({id,roof:[],wall,tiles,depth:.18,curtain:true});
const profiles:Partial<Record<ArtTextureKey,Readonly<Record<number,HouseProfile>>>>={
  world_objects:{
    0:house('old-cottage',[[.07,.57],[.22,.09],[.64,.08],[.89,.55]],[.53,.60,.60,.83],[.35,.25,.48,.33]),
    1:house('old-inn',[[.07,.42],[.18,.09],[.68,.09],[.87,.40]],[.32,.53,.42,.65],[.24,.15,.39,.25]),
    2:arch('old-ruin',[[.16,.75],[.23,.35],[.51,.09],[.76,.24],[.86,.70]],[[.65,.96],[.65,.46],[.56,.32],[.47,.30],[.36,.43],[.36,.96]],[.24,.53,.32,.68]),
    3:house('old-shrine',[[.35,.78],[.38,.15],[.52,.03],[.63,.17],[.68,.78]],[.40,.43,.48,.61],[.40,.43,.48,.61],.36),
  },
  world_buildings:{
    0:house('cottage',[[.06,.54],[.19,.12],[.64,.14],[.88,.52]],[.48,.70,.54,.87],[.28,.18,.44,.30]),
    1:house('inn',[[.08,.48],[.18,.21],[.36,.21],[.50,.02],[.67,.21],[.89,.48]],[.38,.58,.49,.67],[.17,.27,.29,.40]),
    2:house('smithy',[[.06,.53],[.29,.18],[.71,.20],[.92,.53]],[.43,.57,.51,.70],[.39,.24,.63,.42]),
    3:house('road-shrine',[[.12,.76],[.25,.47],[.49,.28],[.71,.48],[.88,.76]],[.20,.59,.28,.77],[.31,.40,.39,.49],.40),
    4:arch('ruined-cellar',[[.15,.78],[.17,.04],[.29,.05],[.31,.23],[.46,.10],[.76,.38],[.87,.76]],[[.65,.96],[.65,.50],[.56,.38],[.45,.28],[.36,.43],[.36,.96]],[.23,.43,.30,.61]),
    5:tower('timber-watchtower',[.32,.61,.43,.76],[.25,.24,.3625,.27],[
      {left:.23,right:.79,top:.84,bottom:.96,patch:[.25,.83,.34,.91]},
      {left:.28,right:.74,top:.44,bottom:.88},
      {left:.17,right:.86,top:.28,bottom:.47,patch:[.27,.38,.37,.435]},
    ],{left:.16,right:.88,eave:.29,peak:.13}),
  },
  capital_buildings:{
    0:house('hall',[[.07,.46],[.15,.10],[.72,.10],[.83,.46]],[.57,.58,.64,.79],[.33,.16,.52,.29]),
    1:house('manor',[[.08,.49],[.21,.09],[.73,.12],[.92,.49]],[.52,.59,.60,.72],[.35,.24,.44,.32]),
    2:tower('crown-watchtower',[.24,.57,.34,.69],[.45,.23,.60,.27],[
      {left:.20,right:.82,top:.84,bottom:.96},
      {left:.26,right:.76,top:.44,bottom:.90},
      {left:.15,right:.87,top:.32,bottom:.47,patch:[.23,.35,.34,.43]},
    ],{left:.08,right:.94,eave:.33,peak:.12}),
    3:arch('gatehouse',[[.07,.22],[.29,.22],[.33,.37],[.66,.37],[.70,.22],[.93,.22]],[[.60,.97],[.60,.76],[.58,.67],[.52,.61],[.46,.64],[.41,.74],[.41,.97]],[.12,.45,.22,.59],[.38,.34,.48,.40],.42),
    4:house('chapel',[[.16,.55],[.48,.22],[.80,.56]],[.20,.64,.29,.81],[.27,.49,.37,.56]),
    5:house('capital-smithy',[[.07,.52],[.26,.17],[.68,.17],[.90,.51]],[.49,.55,.57,.65],[.31,.24,.4975,.3675]),
    6:house('stable',[[.08,.45],[.25,.09],[.77,.10],[.92,.45]],[.49,.53,.53,.84],[.28,.17,.44,.30]),
    7:house('storehouse',[[.08,.47],[.37,.12],[.70,.44],[.83,.47]],[.27,.53,.38,.64],[.23,.33,.33,.43]),
    8:house('castle',[[.05,.38],[.10,.17],[.19,.16],[.24,.39],[.39,.36],[.45,.07],[.63,.07],[.67,.37],[.78,.38],[.83,.17],[.91,.17],[.96,.40]],[.36,.56,.41,.74],[.28,.39,.35,.47],.54),
    9:tower('signal-tower',[.24,.53,.34,.65],[.24,.53,.34,.65],[
      {left:.22,right:.81,top:.84,bottom:.96},
      {left:.28,right:.76,top:.30,bottom:.89},
      {left:.16,right:.87,top:.22,bottom:.34},
    ]),
  },
  elven_villas:{
    0:house('elven-cottage',[[.06,.57],[.25,.41],[.48,.12],[.75,.43],[.91,.55]],[.55,.67,.64,.81],[.30,.38,.405,.4475]),
    1:house('elven-manor',[[.08,.49],[.29,.32],[.51,.13],[.72,.35],[.92,.48]],[.24,.53,.33,.64],[.35,.34,.42,.42]),
    2:tower('elven-watchtower',[.29,.58,.39,.73],[.39,.23,.50,.27],[
      {left:.21,right:.83,top:.86,bottom:.96},
      {left:.29,right:.76,top:.42,bottom:.91},
      {left:.17,right:.87,top:.28,bottom:.44,patch:[.26,.33,.35,.385]},
    ],{left:.13,right:.91,eave:.30,peak:.11}),
    3:arch('elven-gate',[[.07,.39],[.19,.18],[.27,.39],[.49,.25],[.72,.39],[.82,.18],[.95,.39]],[[.63,.98],[.63,.70],[.60,.56],[.52,.47],[.43,.55],[.38,.69],[.38,.98]],[.20,.52,.27,.67],[.47,.39,.54,.425],.42),
    4:house('elven-chapel',[[.15,.60],[.35,.35],[.49,.11],[.66,.36],[.86,.59]],[.20,.63,.29,.79],[.23,.48,.33,.58]),
    5:house('elven-smithy',[[.05,.52],[.30,.17],[.51,.29],[.72,.28],[.91,.51]],[.28,.58,.36,.71],[.32,.30,.47,.44]),
    6:house('elven-stable',[[.05,.40],[.30,.17],[.47,.05],[.70,.24],[.94,.41]],[.44,.55,.50,.73],[.29,.29,.38,.335]),
    7:house('elven-guildhall',[[.07,.48],[.30,.23],[.50,.13],[.78,.42],[.94,.48]],[.42,.60,.49,.79],[.30,.33,.44,.43]),
    8:house('elven-estate',[[.07,.59],[.24,.36],[.38,.16],[.61,.16],[.77,.37],[.94,.59]],[.27,.58,.34,.71],[.29,.30,.39,.42]),
    9:house('elven-palace',[[.05,.65],[.14,.26],[.23,.64],[.36,.59],[.49,.12],[.69,.60],[.81,.64],[.89,.25],[.98,.65]],[.43,.69,.48,.81],[.46,.37,.53,.46],.50),
  },
  others:{11:{...house('contract-board',[[.07,.21],[.16,.03],[.82,.03],[.94,.22]],[.17,.71,.23,.80],[.34,.13,.47,.20],.035),board:true}},
  native_civic_bare:{11:{...house('bare-contract-board',[[.04,.21],[.14,.03],[.85,.03],[.97,.22]],[.14,.70,.20,.80],[.33,.13,.46,.20],.035),board:true}},
  royal_walls:{
    0:curtain('rising-curtain',[.32,.46,.49,.63],[.30,.32,.44,.38]),
    1:curtain('falling-curtain',[.37,.45,.54,.61],[.41,.30,.54,.37]),
    2:curtain('horizontal-curtain',[.20,.53,.34,.68],[.15,.32,.23,.38]),
    3:tower('wall-corner-tower',[.31,.45,.48,.67],[.31,.45,.48,.67],[
      {left:.22,right:.80,top:.27,bottom:.93},{left:.12,right:.90,top:.17,bottom:.32},
    ]),
    4:arch('closed-royal-gate',[[.06,.35],[.07,.08],[.22,.08],[.24,.30],[.49,.20],[.74,.30],[.77,.08],[.94,.08],[.95,.35]],[],[.09,.50,.18,.67],[.09,.50,.18,.67],.25),
    5:arch('open-royal-gate',[[.07,.32],[.08,.06],[.24,.06],[.27,.25],[.49,.17],[.75,.25],[.78,.07],[.93,.07],[.94,.32]],[[.61,.98],[.61,.66],[.58,.52],[.51,.44],[.44,.48],[.39,.62],[.39,.98]],[.10,.51,.20,.70],[.10,.51,.20,.70],.27),
  },
};
// Other freestanding masonry uses its own source frame, never the town-wall
// texture on an unrelated structure. Open arches retain a tunnel all the way through.
const wallProfiles:Record<number,HouseProfile>={};
for(let i=0;i<25;i++)wallProfiles[i]=house('masonry-'+i,[[.19,.24],[.80,.24]],[.35,.46,.53,.64],[.35,.46,.53,.64],.42);
for(const i of [20,21,22,24])wallProfiles[i]=arch('masonry-arch-'+i,[[.08,.26],[.27,.20],[.49,.10],[.73,.20],[.93,.26]],
  [[.66,.97],[.66,.64],[.61,.46],[.51,.37],[.41,.45],[.35,.62],[.35,.97]],i===21?[.30,.42,.39,.55]:i===22?[.34,.49,.41,.60]:[.10,.48,.22,.66]);
profiles.walls=wallProfiles;
profiles.darkav_props={3:profiles.world_buildings![4]};


export function architectureProfile(texture:ArtTextureKey,frame:number){return profiles[texture]?.[frame];}

/** A cart-width opening and its masonry use one plan in mesh and physics. */
export const AUTHORED_GATE={left:.15,right:.85,openingRatio:.55,backRatio:.86,front:.03} as const;
export function authoredGateOpening(){
  const middle=(AUTHORED_GATE.left+AUTHORED_GATE.right)/2;
  const half=(AUTHORED_GATE.right-AUTHORED_GATE.left)*AUTHORED_GATE.openingRatio/2;
  return {left:middle-half,right:middle+half};
}
export interface ArchitectureFootprint {left:number;right:number;back:number;front:number}
/** X is a fraction of visible width; Z is measured in visible-width units. */
export function architecturePassageFootprints(profile:HouseProfile):ArchitectureFootprint[]|undefined {
  if(!profile.opening?.length)return;
  if(profile.id==='gatehouse'||profile.id==='elven-gate'){
    const opening=authoredGateOpening(),rim=.017;
    return [{left:.085,right:opening.left+rim,back:-profile.depth*AUTHORED_GATE.backRatio,front:AUTHORED_GATE.front},
      {left:opening.right-rim,right:.92,back:-profile.depth*AUTHORED_GATE.backRatio,front:AUTHORED_GATE.front}];
  }
  const base=Math.max(...profile.opening.map(p=>p[1]));
  const feet=profile.opening.filter(p=>p[1]>=base-.001).map(p=>p[0]);
  const left=Math.min(...feet),right=Math.max(...feet);
  return [{left:profile.roof[0][0],right:left,back:-profile.depth,front:0},
    {left:right,right:profile.roof[profile.roof.length-1][0],back:-profile.depth,front:0}];
}
/** World-space frontage, fitted before instancing the complete model. */
export const CASTLE_FRONTAGE=HERO_BODY_HEIGHT*22;
export function architectureMinimumWidth(texture:ArtTextureKey,frame:number){
  const p=architectureProfile(texture,frame);
  if(!p||p.board||p.curtain)return 0;
  if(p.id==='castle'||p.id==='elven-palace')return CASTLE_FRONTAGE;
  if(p.tiers)return HERO_BODY_HEIGHT*2.4;
  if(p.opening?.length)return HERO_BODY_HEIGHT*4.5;
  if(/^masonry-/.test(p.id))return HERO_BODY_HEIGHT*2.8;
  return HERO_BODY_HEIGHT*(/cottage/.test(p.id)?5.2:/inn|manor|estate/.test(p.id)?6.2:/shrine|chapel/.test(p.id)?4.4:5.2);
}
/** One scale for X, height and depth. Doors and carved details never receive
 * a separate vertical stretch to compensate for an undersized floor plan. */
export function architectureMinimumScale(texture:ArtTextureKey,frame:number,width:number,height:number){
  const p=architectureProfile(texture,frame);if(!p||p.board||p.curtain)return 0;
  let minimumHeight=0;
  if(p.tiers)minimumHeight=HERO_BODY_HEIGHT*4.5;
  else if(p.opening?.length){
    const opening=Math.max(...p.opening.map(v=>v[1]))-Math.min(...p.opening.map(v=>v[1]));
    minimumHeight=HERO_BODY_HEIGHT*1.45/Math.max(.1,opening);
  }else if(/^masonry-/.test(p.id))minimumHeight=HERO_BODY_HEIGHT*2.2;
  else{
    const door=/cottage/.test(p.id)?.28:/inn|manor|estate/.test(p.id)?.24:/smithy|stable/.test(p.id)?.28:.25;
    minimumHeight=HERO_BODY_HEIGHT*1.25/door;
  }
  return Math.max(architectureMinimumWidth(texture,frame)/Math.max(1,width),minimumHeight/Math.max(1,height));
}
