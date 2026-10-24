import {ModelMesh,atlasMaterial,paintedMaterial,brass,glass,pigment,regionalFabric,regionalWood,masonry,roofMaterial,type ModelMaterial,type V3} from './ModelMesh';
import type Phaser from 'phaser';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';
import {createAuthoredArchitecture} from './ArchitectureGeometry';

type Point=readonly [number,number];
type Patch=readonly [number,number,number,number];
interface Tier {left:number;right:number;top:number;bottom:number;patch?:Patch}
interface HouseProfile {
  id:string;roof:readonly Point[];wall:Patch;tiles:Patch;depth:number;
  opening?:readonly Point[];tiers?:readonly Tier[];hip?:{left:number;right:number;eave:number;peak:number};
  curtain?:boolean;board?:boolean;
}
export interface WallSegment {dx:number;dy:number}
export interface HouseShape {
  profile:HouseProfile;left:number;top:number;width:number;height:number;depth:number;ground?:number;
  segment?:WallSegment&{height:number;thickness:number};
  /** Original survey rectangle within the retained (possibly alpha-trimmed) art. */
  paintRegion?:readonly [number,number,number,number];
}
// Visual depth is an authored proportion of visible width. Collision strips
// describe feet in the old painting; they are not a building's physical depth.
const house=(id:string,roof:readonly Point[],wall:Patch,tiles:Patch,depth=.70):HouseProfile=>({id,roof,wall,tiles,depth});
const tower=(id:string,wall:Patch,tiles:Patch,tiers:readonly Tier[],hip?:HouseProfile['hip']):HouseProfile=>({
  id,roof:[],wall,tiles,depth:.76,tiers,hip,
});
const arch=(id:string,roof:readonly Point[],opening:readonly Point[],wall:Patch,tiles=wall,depth=.30):HouseProfile=>({
  ...house(id,roof,wall,tiles,depth),opening,
});
const curtain=(id:string,wall:Patch,tiles:Patch):HouseProfile=>({id,roof:[],wall,tiles,depth:.18,curtain:true});
// Authored window crops from the existing facade, reused as framed windows on
// side/rear elevations. Circular towers and open ruins never enter this path.
const houseWindows:Record<string,Patch>={
  'timber-watchtower':[.32,.30,.40,.42],'crown-watchtower':[.46,.36,.53,.42],
  'elven-watchtower':[.40,.28,.57,.38],'tower-of-might':[.37,.29,.43,.40],
  'old-cottage':[.28,.57,.43,.77],'old-inn':[.49,.48,.62,.67],
  cottage:[.30,.61,.44,.82],inn:[.69,.65,.85,.84],
  hall:[.48,.68,.525,.79],manor:[.61,.67,.70,.80],chapel:[.37,.43,.59,.76],
  storehouse:[.38,.20,.53,.42],castle:[.268,.568,.299,.657],
  'elven-cottage':[.18,.58,.28,.78],'elven-manor':[.44,.53,.59,.73],
  'elven-chapel':[.36,.27,.61,.73],'elven-guildhall':[.24,.47,.34,.65],
  'elven-estate':[.43,.51,.58,.74],'elven-palace':[.45,.30,.56,.57],
};
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

/** The separately streamed endgame tower is not an ART_SHEETS frame. */
export function towerOfMightShape():HouseShape{
  const profile=tower('tower-of-might',[.33,.49,.37,.53],[.39,.445,.46,.46],[
    {left:.18,right:.83,top:.84,bottom:.96},
    {left:.25,right:.77,top:.16,bottom:.87},
    {left:.23,right:.79,top:.61,bottom:.65},
    {left:.24,right:.78,top:.43,bottom:.47},
    {left:.25,right:.77,top:.25,bottom:.28},
    {left:.23,right:.79,top:.13,bottom:.17},
  ]);
  return {profile,left:0,top:0,width:1,height:1,depth:towerDiameter(profile),ground:1};
}

/** Diameter in visible-source units. All tier radii use the same world X/Z
 * scale, so changing source/frame aspect cannot turn a tower into an ellipse. */
export function towerDiameter(profile:HouseProfile){return Math.max(...(profile.tiers??[]).map(t=>t.right-t.left),profile.hip?profile.hip.right-profile.hip.left:0);}

export function houseShape(texture:ArtTextureKey,frame:Phaser.Textures.Frame,index:number,segment?:WallSegment):HouseShape|undefined {
  const profile=profiles[texture]?.[index];if(!profile)return;
  if(profile.curtain&&!segment)return;
  const metadata=frame.customData as {visibleBounds?:{left:number;top:number;width:number;height:number};sourceRegion?:readonly number[]}|undefined;
  const bounds=metadata?.visibleBounds;if(!bounds)return;
  const sheet=ART_BY_KEY[texture],density=sheet.density,original=sheet.regions?.[index]??sheet.sources?.[index]?.cell,actual=metadata?.sourceRegion;
  const paintRegion=original&&actual?[(original[0]-actual[0])/actual[2],(original[1]-actual[1])/actual[3],original[2]/actual[2],original[3]/actual[3]] as const:undefined;
  return {profile,left:bounds.left*density/frame.cutWidth,top:bounds.top*density/frame.cutHeight,
    width:bounds.width*density/frame.cutWidth,height:bounds.height*density/frame.cutHeight,paintRegion,
    depth:profile.curtain&&segment?1:bounds.width*density*(profile.tiers?towerDiameter(profile):profile.depth)/frame.cutWidth,
    ...(profile.curtain&&segment?{segment:{...segment,height:0,thickness:0}}:{})};
}

/** Structural surfaces use material swatches and modeled joinery. A complete
 * painted building is never placed across a facade or wrapped over a tower. */
export function createHouseGeometry(shape:HouseShape,inflate=0,emission=false){
  const authored=createAuthoredArchitecture(shape,emission);if(authored)return authored;
  const {profile,left,top,width,height,depth}=shape;
  const m=new ModelMesh(shape,emission,width);
  const crop=(p:Patch):Patch=>{const r=shape.paintRegion;return r?[r[0]+p[0]*r[2],r[1]+p[1]*r[3],r[0]+p[2]*r[2],r[1]+p[3]*r[3]]:p;};
  // Dedicated flat diffuse materials wrap every elevation consistently.
  const wall:ModelMaterial=profile.id==='panel'?paintedMaterial(profile.wall,width*.24,height*.24):/timber-watchtower|stable/.test(profile.id)?atlasMaterial('architecture',1,width*.50,height*.60):/old-cottage|^cottage$|^inn$|old-inn/.test(profile.id)?atlasMaterial('architecture',2,width*.55,height*.55):masonry(profile.id);
  const tiles:ModelMaterial=/^masonry-|^panel$/.test(profile.id)?wall:roofMaterial(profile.id);
  const wood:ModelMaterial=regionalWood(profile.id);
  const pane:ModelMaterial=profile.id==='tower-of-might'?{color:pigment(0x322e4e),emission:pigment(0x9981e5)}:glass;
  const darkWood=atlasMaterial('furnishings',2,.45,.65);
  const P=(x:number,y:number,z:number):V3=>[left+x*width-.5,.5-top-y*height,z];
  const B=(l:number,r:number,t:number,b:number,z:number,back:number,mat:ModelMaterial=wall)=>{
    const a=P(l,b,back),c=P(r,t,z);m.box(a[0],c[0],a[1],c[1],back,z,mat);
  };
  const window=(cx:number,cy:number,cz:number,rx:number,rz:number,w:number,h:number)=>{
    const nx=-rz,nz=rx;
    const p=(x:number,y:number,out=0):V3=>[cx+rx*x+nx*out,cy+y,cz+rz*x+nz*out];
    m.quad(p(-w/2,-h/2,.003),p(w/2,-h/2,.003),p(-w/2,h/2,.003),p(w/2,h/2,.003),pane);

    for(const y of [-h/2,h/2])m.beam(p(-w/2-.007,y,.012),p(w/2+.007,y,.012),.008,wood);
    for(const x of [-w/2,w/2])m.beam(p(x,-h/2,.012),p(x,h/2,.012),.008,wood);
    m.beam(p(0,-h/2,.014),p(0,h/2,.014),.004,brass);
    m.beam(p(-w/2,0,.014),p(w/2,0,.014),.004,brass);
  };
  const door=(cx:number,base:number,eave:number,z=0)=>{
    const dh=Math.min(.28,(base-eave)*.88),l=cx-.082,r=cx+.082,head=base-dh;
    B(l,r,head,base,z+.009,z-.005,darkWood);
    for(let i=0;i<5;i++)B(l+i*(r-l)/5+.002,l+(i+1)*(r-l)/5-.002,head+.006,base-.004,z+.015,z+.009,wood);

    for(const x of [l-.012,r+.012])B(x-.010,x+.010,head-.012,base,z+.028,z-.008,wall);
    B(l-.022,r+.022,head-.022,head,z+.028,z-.008,wall);
    for(const y of [head+dh*.22,base-dh*.22])B(l,r,y,y+.012,z+.025,z+.015,metalDoor);
    const knob=P(r-.025,base-dh*.48,z+.030);m.beam(knob,[knob[0],knob[1],knob[2]+.013],.008,brass,8);
    for(let i=0;i<2;i++)B(l-.04,r+.04,base-.025*(2-i),base,z+.045+i*.035,z,wall);
  };
  const metalDoor=atlasMaterial('furnishings',3,.22,.22);
  if(profile.curtain&&shape.segment){
    const box=(l:number,r:number,b:number,t:number)=>m.box(l,r,b,t,-1,0,wall);
    box(-.5,.5,-.5,.30);
    const count=profile.id==='horizontal-curtain'?7:3;
    for(let i=0;i<count;i++)box(-.5+i/count,-.5+(i+.57)/count,.30,.5);
  }else if(profile.tiers){
    const centerX=left+(Math.min(...profile.tiers.map(t=>t.left))+Math.max(...profile.tiers.map(t=>t.right)))*width/2-.5;
    const centerZ=-depth/2,bottom=Math.max(...profile.tiers.map(t=>t.bottom));
    for(const tier of profile.tiers){
      const r=(tier.right-tier.left)*width/2+inflate,cx=left+(tier.left+tier.right)*width/2-.5;
      const low=P(0,tier.bottom===bottom?Math.max(bottom,shape.ground??bottom):tier.bottom,0)[1],high=P(0,tier.top,0)[1];
      m.cylinder(cx,centerZ,low,high,r,r,wall,32);
      if(tier.bottom-tier.top>.25){
        const rows=tier.bottom-tier.top>.5?2:1;
        for(let row=0;row<rows;row++)for(let i=0;i<4;i++){
          const a=i*Math.PI/2+Math.PI/4,y=low+(high-low)*(row+1)/(rows+1);
          window(cx+Math.sin(a)*r,y,centerZ+Math.cos(a)*r,Math.cos(a),-Math.sin(a),Math.min(.11,r*.42),Math.min(.13,(high-low)*.30));
        }
      }
    }
    const hip=profile.hip;
    if(hip){
      const r=(hip.right-hip.left)*width/2,cy=P(0,hip.eave,0)[1],peak=P(0,hip.peak,0)[1];
      m.cylinder(centerX,centerZ,cy,peak,r,0,tiles,32);
      m.ring(centerX,centerZ,cy-.008,cy+.008,r*1.01,r*.96,wood,32);
      m.beam([centerX,peak,centerZ],[centerX,peak+.10,centerZ],.008,brass,8);
      m.triangle([centerX,peak+.09,centerZ],[centerX+.12,peak+.06,centerZ],[centerX,peak+.035,centerZ],regionalFabric(profile.id));
    }else{
      const crown=profile.tiers.reduce((a,b)=>b.top<a.top?b:a),r=(crown.right-crown.left)*width*.43,y=P(0,crown.top,0)[1];
      for(let i=0;i<12;i++){
        const a=i/12*Math.PI*2,x=centerX+Math.sin(a)*r,z=centerZ+Math.cos(a)*r;
        m.box(x-.022,x+.022,y,y+.075*height,z-.022,z+.022,wall);
      }
    }
    const banner:Patch|undefined=profile.id==='crown-watchtower'?[.34,.50,.63,.75]:profile.id==='elven-watchtower'?[.31,.44,.64,.73]:profile.id==='timber-watchtower'?[.43,.44,.69,.65]:undefined;
    if(banner){
      const main=profile.tiers.reduce((a,b)=>b.bottom-b.top>a.bottom-a.top?b:a),r=(main.right-main.left)*width/2;
      const y=P(0,main.top+(main.bottom-main.top)*.28,0)[1],h=(main.bottom-main.top)*height*.29,w=r*.62;
      const z=centerZ+r+.012;
      m.extrude([[centerX-w/2,y],[centerX+w/2,y],[centerX+w/2,y-h*.82],[centerX,y-h],[centerX-w/2,y-h*.82]],z,z-.006,regionalFabric(profile.id));

    }
    const base=Math.max(bottom,shape.ground??bottom),main=profile.tiers.reduce((a,b)=>b.bottom-b.top>a.bottom-a.top?b:a);
    door((main.left+main.right)/2,base,main.top,centerZ+(main.right-main.left)*width/2+.002);
  }else if(profile.board){
    B(.09,.91,.23,.77,0,-depth,wood);B(.13,.22,.72,.97,0,-depth,wood);B(.79,.88,.72,.97,0,-depth,wood);
    const roof=profile.roof,path=[...roof,[roof[roof.length-1][0],.25],[roof[0][0],.25]] as Point[];
    m.extrude(path.map(([x,y])=>{const p=P(x,y,0);return [p[0],p[1]] as const;}),.008,-depth,tiles);
    m.cutout(P(.16,.75,.008),P(.87,.75,.008),P(.16,.29,.008),P(.87,.29,.008),crop([.16,.29,.87,.75]));

  }else{
    const roof=profile.roof,first=roof[0],last=roof[roof.length-1],base=Math.max(.96,shape.ground??.96,...(profile.opening??[]).map(p=>p[1]));
    const forge=/smithy/.test(profile.id);
    const opening:readonly Point[]=forge?[[.75,base],[.75,Math.max(first[1],last[1])+.05],[.22,Math.max(first[1],last[1])+.05],[.22,base]]:profile.opening??[];
    const path:Point[]=[...roof,[last[0],base],...opening,[first[0],base]];
    const coords=path.map(([x,y])=>{const p=P(x,y,0);return [p[0],p[1]] as const;});
    m.extrude(coords,0,-depth,wall,path.map((_,i)=>i<roof.length-1?tiles:wall));
    // Raised eave/ridge joinery follows the silhouette across the full depth.
    for(let i=1;i<roof.length&&!/^masonry-|^panel$/.test(profile.id);i++){
      m.beam(P(...roof[i-1],.008),P(...roof[i],.008),.009,wood);
      m.beam(P(...roof[i-1],-depth-.008),P(...roof[i],-depth-.008),.009,wood);
    }
    const eave=Math.max(first[1],last[1]);
    if(profile.id!=='panel'&&!profile.id.startsWith('masonry-')&&!profile.opening?.length){
      B(first[0]-.008,last[0]+.008,base-.055,base,.006,-depth-.012,wall);
      if(!/stable|smithy/.test(profile.id))for(const x of [first[0],last[0]]){
        for(let i=0;i<4;i++){const t=eave+(base-eave)*i/4,b=eave+(base-eave)*(i+.88)/4;B(x-.018,x+.038,t,b,.016,-depth-.016,wall);}
      }
      for(const x of [first[0],last[0]])for(const z of [0,-depth+.024])B(x-.012,x+.012,eave,base,z+.009,z-.028,wood);
      B(first[0]-.014,last[0]+.014,eave-.010,eave+.016,.008,-depth-.008,wood);
      if(/cottage|inn|stable|smithy/.test(profile.id)){
        const peak=roof.reduce((a,b)=>b[1]<a[1]?b:a);
        for(const z of [.012,-depth-.012])m.beam(P(peak[0],peak[1]+.015,z),P(peak[0],eave,z),.010,wood);
        const x=first[0]+(last[0]-first[0])*.73;
        const edge=roof.findIndex((p,i)=>i>0&&roof[i-1][0]<=x&&p[0]>=x);
        if(edge>0){
          const a=roof[edge-1],b=roof[edge],y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
          B(x-.038,x+.038,y-.13,y+.04,-depth*.56,-depth*.72,wall);
          B(x-.046,x+.046,y-.145,y-.12,-depth*.55,-depth*.73,wall);
          const p=P(x,y-.145,-depth*.64);
          m.quad([p[0]-.02,p[1]+.001,p[2]+.02],[p[0]+.02,p[1]+.001,p[2]+.02],[p[0]-.02,p[1]+.001,p[2]-.02],[p[0]+.02,p[1]+.001,p[2]-.02],darkWood);
        }
      }
      if(/inn|manor|hall|castle|palace|estate/.test(profile.id)){
        const floor=eave+(base-eave)*.48;B(first[0],last[0],floor,floor+.022,.014,-depth-.014,wood);
      }
      if(!/shrine/.test(profile.id)&&!forge)door((first[0]+last[0])/2,base,eave);
      else if(/shrine/.test(profile.id)){
        const mid=(first[0]+last[0])/2,y=eave+(base-eave)*.40,w=(last[0]-first[0])*.34;
        const source=profile.id==='road-shrine'?[.36,.40,.64,.75] as Patch:houseWindows[profile.id];
        if(source)m.cutout(P(mid-w/2,base-.13,.009),P(mid+w/2,base-.13,.009),P(mid-w/2,y,.009),P(mid+w/2,y,.009),crop(source));
        for(const x of [first[0]+.035,last[0]-.035])B(x-.035,x+.035,eave+.08,base,.045,-depth-.02,wall);
        for(let i=0;i<3;i++)B(mid-.22-i*.035,mid+.22+i*.035,base-.03+i*.012,base+.02,.04+i*.04,-.03,wall);
      }
      if(forge){
        // An open forge and a chimney identify a smithy from every angle.
        // The original fire is a cropped effect, with solid masonry around it.
        const fireStone=atlasMaterial('architecture',15,width*.30,height*.30);
        B(.22,.75,eave+.05,base,-depth+.025,-depth,wall);
        B(.72,.89,.08,base-.31,.035,-depth*.26,fireStone);
        B(.72,.745,base-.31,base-.10,.035,-depth*.26,fireStone);
        B(.865,.89,base-.31,base-.10,.035,-depth*.26,fireStone);
        B(.70,.91,.06,.10,.050,-depth*.28,fireStone);
        B(.71,.90,base-.10,base,.068,-.04,fireStone);
        B(.745,.865,base-.31,base-.11,-depth*.15,-depth*.26,darkWood);
        const f=P(.805,base-.12,.046),source:Patch=profile.id==='elven-smithy'?[.57,.41,.69,.56]:profile.id==='capital-smithy'?[.68,.62,.79,.77]:[.68,.60,.81,.78];
        m.fire(f[0],f[1],f[2],width*.12,height*.20,crop(source));
        B(.31,.60,base-.27,base-.20,.055,-depth*.16,wood);
        for(const x of [.33,.58])B(x-.018,x+.018,base-.20,base,.025,-depth*.12,wood);
        const a=P(.45,base-.27,.028);m.box(a[0]-.055,a[0]+.055,a[1],a[1]+.035,-.02,.065,metalDoor);
      }
      if(houseWindows[profile.id]||/stable|shrine/.test(profile.id)){
        const wy=eave+(base-eave)*.43,cy=P(0,wy,0)[1],wh=(base-eave)*height*.37,ww=Math.min(.14,(last[0]-first[0])*.2)*width;
        for(const x of [first[0]+(last[0]-first[0])*.20,first[0]+(last[0]-first[0])*.80]){
          window(P(x,0,0)[0],cy,.005,1,0,ww,wh);window(P(x,0,0)[0],cy,-depth-.005,-1,0,ww,wh);
        }
        for(const x of [first[0],last[0]])for(let i=0;i<2;i++){
          const z=-depth*(i+.5)/2,s=x===first[0]?-1:1;
          window(P(x,0,0)[0]+s*.005,cy,z,0,-s,ww,wh);
        }
      }
    }
  }
  return m.finish();
}

/** Closed interior panels share original art and do not acquire town-wall
 * profiles. The existing crop/UV rectangle still limits each room segment. */
export function createWallGeometry(depth:number){
  const shape:HouseShape={profile:house('panel',[[0,0],[1,0]],[.05,.15,.12,.85],[.05,.15,.12,.85],depth),left:0,top:0,width:1,height:1,depth};
  return createHouseGeometry(shape);
}
