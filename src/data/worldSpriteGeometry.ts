import type {ArtTextureKey} from './art';

export type GroundPoint = readonly [x:number,y:number];
export type GroundPolygon = readonly GroundPoint[];
export interface WorldSpriteProfile {
  /** Coordinates relative to the visible illustration, NOT its atlas cell. */
  solids:readonly GroundPolygon[];sortY:number;forceSolid?:boolean;floor?:boolean;
}
const box=(l:number,t:number,r:number,b:number):GroundPolygon=>[[l,t],[r,t],[r,b],[l,b]];
const base=(l:number,t:number,r:number,b:number):GroundPolygon=>[
  [l+.07,t],[r-.07,t],[r,b-.035],[r-.07,b],[l+.07,b],[l,b-.035],
];
const profile=(polygon:GroundPolygon,sortY=.96,forceSolid=true):WorldSpriteProfile=>({solids:[polygon],sortY,forceSolid});
const floor:WorldSpriteProfile={solids:[],sortY:1,floor:true};
// Ground-plane contours surveyed from the supplied illustrations. Roofs,
// canopy, spear/banner height and transparent padding are NOT solid volume.
const buildings:WorldSpriteProfile[]=[
  profile(base(.05,.73,.95,.965)), // thatched cottage, stoop and side stock
  profile(base(.04,.76,.97,.975)), // inn and projecting lower wing
  profile(base(.035,.76,.975,.97)), // smith's wall, forge and wheel
  profile(base(.10,.80,.90,.98)), // shrine steps/plinth
  {solids:[base(.055,.70,.38,.97),base(.64,.76,.96,.97)],sortY:.97,forceSolid:true}, // open ruin
  profile(base(.14,.76,.92,.97)), // watchtower base (not the roof)
];
const capital:WorldSpriteProfile[]=[
  profile(base(.035,.70,.97,.97)), // hall: fence and right-hand porch included
  profile(base(.025,.76,.98,.975)),
  profile(base(.08,.79,.92,.975)),
  {solids:[base(.035,.74,.39,.97),base(.60,.74,.98,.97)],sortY:.96,forceSolid:true}, // real gate opening
  profile(base(.10,.81,.92,.975)),
  profile(base(.03,.71,.97,.975)),
  profile(base(.035,.72,.97,.975)),
  profile(base(.025,.75,.97,.98)),
  profile(base(.04,.78,.96,.98)), // large castle, side towers and stair court
  profile(base(.09,.80,.93,.98)),
];
// Elven boards have their own foundations; do not use a generic 56-unit
// rectangle or mistake the palace's side arches for closed building walls.
const elven:WorldSpriteProfile[]=[
  profile(base(.025,.73,.98,.98)),profile(base(.025,.76,.98,.98)),
  profile(base(.06,.82,.97,.98)),
  {solids:[base(.025,.76,.415,.98),base(.625,.76,.985,.98)],sortY:.97,forceSolid:true},
  profile(base(.035,.79,.97,.98)),profile(base(.025,.70,.98,.98)),
  profile(base(.025,.72,.98,.98)),profile(base(.03,.77,.98,.98)),
  profile(base(.025,.79,.98,.98)),
  {solids:[base(.035,.81,.20,.98),base(.31,.75,.78,.98),base(.89,.81,.985,.98)],sortY:.97,forceSolid:true},
];
const lifeTree=profile([[.44,.73],[.58,.74],[.72,.86],[.84,.925],[.71,.965],[.30,.965],[.16,.925],[.30,.855]],.965);
const flowerFences=[profile(box(.02,.78,.98,.91),.9),profile(box(.29,.06,.65,.96),.96),
  profile(box(.22,.06,.73,.96),.96),profile(box(.20,.06,.78,.96),.96)];
const trees:WorldSpriteProfile[]=[
  profile([[.41,.77],[.58,.78],[.84,.93],[.75,.98],[.23,.98],[.17,.94]],.965),
  profile([[.41,.80],[.58,.80],[.75,.93],[.67,.98],[.30,.98],[.25,.94]],.965),
];
const winterTrees=[profile(base(.08,.82,.94,.98)),profile(base(.08,.81,.94,.98))];
const others:WorldSpriteProfile[]=[
  profile(base(.09,.86,.51,.98)), // pole only, not the hanging lamp
  profile(base(.15,.83,.85,.98)),
  profile(base(.10,.84,.58,.98)),
  profile(base(.10,.76,.89,.98)),
  profile(base(.28,.83,.75,.98)),
  profile(base(.025,.73,.975,.98)),
  profile(base(.035,.70,.965,.98)),
  profile(base(.045,.53,.96,.96)),
  profile(base(.04,.60,.96,.975)),
  profile(base(.035,.65,.97,.975)),
  profile(base(.04,.37,.96,.975)),
  profile(base(.15,.80,.86,.98)),
  profile(base(.24,.83,.76,.98)),
  profile(base(.12,.81,.87,.98)),
];
export function worldSpriteProfile(texture:ArtTextureKey,frame:number):WorldSpriteProfile|undefined {
  if(texture==='native_quest_landmarks')return {solids:[base(.04,frame===2?.75:frame===5?.60:.79,.96,.98)],sortY:.97};
  if(texture==='native_civic_bare')return others[frame];
  if(texture==='native_story_props'||texture==='native_story_bare')return {solids:[frame===5?base(.25,.86,.75,.98):
    frame===6&&texture==='native_story_bare'?base(.30,.83,.62,.98):base(.06,frame===4?.62:.76,.94,.98)],sortY:.97};
  if(texture==='native_forge_record')return {solids:[base(.06,.74,.94,.98)],sortY:.97};
  if(texture==='native_keepsakes')return {solids:[base(.08,frame>=2?.78:.68,.92,.98)],sortY:.97};
  if(texture==='native_region_props')return frame===0?profile(base(.40,.86,.63,.98)):
    frame===3||frame===4?{solids:[],sortY:.97}:
      {solids:[base(.05,frame===1?.57:.66,.95,.98)],sortY:.97};
  if(texture==='pirate_flagship')return floor;
  if(texture==='port_dock')return floor;
  if(texture==='elarion_tree')return lifeTree;
  if(texture==='flower_fence')return flowerFences[frame];
  if(texture==='darkav_props')return frame===0?profile(base(.25,.80,.78,.98)):
    frame===3?buildings[4]:profile(base(.06,.62,.95,.98));
  if(texture==='darkav_volcano')return profile([[.49,.22],[.70,.43],[.89,.64],[.98,.82],[.87,.97],[.15,.98],[.025,.82],[.07,.62],[.29,.40]],.975);
  if(texture==='world_buildings')return buildings[frame];
  if(texture==='capital_buildings')return capital[frame];
  if(texture==='elven_villas')return elven[frame];
  if(texture==='world_objects')return [profile(base(.04,.70,.96,.96)),profile(base(.03,.72,.97,.97)),
    {solids:[base(.05,.72,.36,.97),base(.62,.76,.96,.97)],sortY:.97,forceSolid:true},profile(base(.13,.78,.88,.97))][frame];
  if(texture==='world_assets')return frame<=1?trees[frame]:frame===4?{solids:[],sortY:.96}:
    frame===2?profile(base(.04,.55,.97,.96)):frame===3?profile(base(.035,.78,.965,.975)):
      frame===5?profile(base(.26,.80,.74,.98)):frame===6?profile(base(.08,.62,.91,.96)):profile(base(.035,.62,.97,.97));
  if(texture==='others')return others[frame];
  if(texture==='woodland_props')return [0,1,2,3,4,10].includes(frame)?{solids:[],sortY:.96}:
    frame===5?profile([[.43,.79],[.57,.79],[.79,.94],[.70,.98],[.26,.98],[.19,.94]]):
      frame===6?profile(base(.025,.51,.975,.95)):frame===7?profile(base(.07,.60,.95,.97)):
        frame===11?profile(base(.26,.83,.76,.98)):profile(base(.04,.59,.96,.97));
  if(texture==='desert_props')return frame===2||frame===3||frame===10?{solids:[],sortY:.96}:
    frame===11?{solids:[base(.05,.69,.40,.97),base(.70,.71,.97,.97)],sortY:.97,forceSolid:true}:
      frame===7?profile(base(.22,.79,.76,.96)):frame===9?profile(base(.04,.73,.97,.98)):
        profile(base(.055,frame===0||frame===1 ? .78 : .57,.95,.97));
  if(texture==='climate_props')return frame<=1?winterTrees[frame]:frame===11?floor:
    profile(base(.045,frame===4 ? .76 : frame===5||frame===9 ? .72 : .66,.965,.97));
  if(texture==='flora')return {solids:[],sortY:.96};
  if(texture==='royal_walls')return frame===3?profile(base(.12,.79,.9,.98)):frame===5?
    {solids:[base(.035,.75,.395,.98),base(.6,.75,.975,.98)],sortY:.97,forceSolid:true}:
    {solids:[],sortY:.97}; // curtain/gate collision remains the surveyed seams
  if(texture==='bridges')return frame===2?{solids:[],sortY:.26,floor:true}:frame===8?
    {solids:[base(.08,.68,.28,.97),base(.74,.68,.95,.97)],sortY:.95,forceSolid:true}:floor;
  return undefined;
}

/** Stone bridge: source-space shapes follow the arched deck, not a horizontal
 * image crop. Back/front rail ground boundaries keep the center lane open. */
export const STONE_BRIDGE = {
  backArt:[[[111,405],[153,405],[153,437],[223,412],[302,415],[414,445],[414,402],[456,402],[456,481],[415,474],[363,452],[296,435],[230,431],[151,456],[151,485],[110,485]]] as readonly GroundPolygon[],
  frontArt:[[[105,474],[154,474],[154,490],[225,479],[298,477],[365,486],[413,502],[413,467],[456,467],[456,653],[413,653],[413,541],[365,520],[298,506],[225,507],[154,526],[154,653],[105,653]]] as readonly GroundPolygon[],
  backSolids:[[[154,440],[225,429],[298,430],[366,443],[414,465],[414,472],[366,450],[298,438],[225,437],[154,448]]] as readonly GroundPolygon[],
  frontSolids:[[[154,493],[225,480],[298,478],[366,490],[414,510],[414,518],[366,498],[298,486],[225,488],[154,501]]] as readonly GroundPolygon[],
  backSortY:439,frontSortY:520,
} as const;

/** Simple straight timber posts/ropes, leaving all deck planks in the floor. */
export const TIMBER_BRIDGE = {
  backArt:[[[129,115],[166,115],[166,198],[129,198]],[[327,114],[367,114],[367,198],[327,198]],
    [[163,143],[331,143],[331,173],[163,173]]] as readonly GroundPolygon[],
  frontArt:[[[121,188],[159,188],[159,288],[121,288]],[[327,188],[368,188],[368,288],[327,288]],
    [[158,235],[329,235],[329,266],[158,266]]] as readonly GroundPolygon[],
  backSortY:196,frontSortY:265,
} as const;

/** Small stepped convex contours, including separate ruin/gate pillars. Never
 * replace a hollow structure with its whole bounding rectangle. */
export function polygonGroundBands(polygon:GroundPolygon,count=4,splitConcave=false){
  const top=Math.min(...polygon.map(p=>p[1])),bottom=Math.max(...polygon.map(p=>p[1]));
  const result:Array<{left:number;top:number;right:number;bottom:number}>=[];
  const span=(y:number)=>{
    const xs:number[]=[];
    for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];
      if(a[1]===b[1]){if(Math.abs(y-a[1])<.000001)xs.push(a[0],b[0]);continue;}
      if(y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
    }return xs.sort((a,b)=>a-b);
  };
  if(splitConcave){
    // An arched rail can intersect a scan row twice, with open deck BETWEEN
    // the intersections. Preserve both intervals rather than filling the gap.
    const levels=[...new Set(polygon.map(p=>p[1]))].sort((a,b)=>a-b);
    for(let i=1;i<levels.length;i++){
      const a=levels[i-1],b=levels[i],lo=span(a+.000001),hi=span(b-.000001);
      for(let j=0;j+1<lo.length&&j+1<hi.length;j+=2)
        result.push({left:Math.min(lo[j],hi[j]),top:a,right:Math.max(lo[j+1],hi[j+1]),bottom:b});
    }return result;
  }
  for(let i=0;i<count;i++){
    const a=top+(bottom-top)*i/count,b=top+(bottom-top)*(i+1)/count;
    const samples=[...span(a+.000001),...span(b-.000001),...polygon.filter(p=>p[1]>=a&&p[1]<=b).map(p=>p[0])];
    if(samples.length)result.push({left:Math.min(...samples),top:a,right:Math.max(...samples),bottom:b});
  }return result;
}
