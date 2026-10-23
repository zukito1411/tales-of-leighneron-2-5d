import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2} from 'three';
import type Phaser from 'phaser';
import {ART_BY_KEY,type ArtTextureKey} from '../../data/art';

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
  'old-cottage':[.28,.57,.43,.77],'old-inn':[.49,.48,.62,.67],
  cottage:[.30,.61,.44,.82],inn:[.69,.65,.85,.84],
  hall:[.58,.51,.70,.74],manor:[.58,.58,.72,.77],chapel:[.37,.43,.59,.76],
  storehouse:[.38,.20,.53,.42],castle:[.51,.42,.59,.60],
  'elven-cottage':[.47,.58,.62,.79],'elven-manor':[.44,.53,.59,.73],
  'elven-chapel':[.39,.48,.59,.78],'elven-guildhall':[.45,.50,.60,.72],
  'elven-estate':[.43,.51,.58,.74],'elven-palace':[.46,.57,.59,.76],
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
  const metadata=frame.customData as {visibleBounds?:{left:number;top:number;width:number;height:number}}|undefined;
  const bounds=metadata?.visibleBounds;if(!bounds)return;
  const density=ART_BY_KEY[texture].density;
  return {profile,left:bounds.left*density/frame.cutWidth,top:bounds.top*density/frame.cutHeight,
    width:bounds.width*density/frame.cutWidth,height:bounds.height*density/frame.cutHeight,
    depth:profile.curtain&&segment?1:bounds.width*density*(profile.tiers?towerDiameter(profile):profile.depth)/frame.cutWidth,
    ...(profile.curtain&&segment?{segment:{...segment,height:0,thickness:0}}:{})};
}

type Vertex=readonly [number,number,number];
/** Shared low-poly meshes use only the already prepared source atlas. Opaque
 * material patches repeat at their original texel scale, rather than stretching
 * a tiny stripe over an entire roof/wall. Geometry is built once per active batch. */
export function createHouseGeometry(shape:HouseShape,inflate=0,emission=false){
  const positions:number[]=[],uvs:number[]=[],surfaces:number[]=[],surfaceUVs:number[]=[];
  const {profile,left,top,width,height,depth}=shape;
  const point=(x:number,y:number,z:number):Vertex=>[left+x*width-.5,.5-top-y*height,z];
  const uv=(x:number,y:number):Point=>[left+x*width,1-top-y*height];
  const tri=(a:Vertex,b:Vertex,c:Vertex,ta:Point,tb:Point,tc:Point,patch?:Patch,painted=false)=>{
    if(emission&&patch&&!painted)return;
    positions.push(...a,...b,...c);
    if(patch&&!painted){const center=uv((patch[0]+patch[2])/2,(patch[1]+patch[3])/2);uvs.push(...center,...center,...center);}
    else uvs.push(...ta,...tb,...tc);
    const rect=patch?[left+patch[0]*width,1-top-patch[3]*height,(patch[2]-patch[0])*width*(painted?-1:1),(patch[3]-patch[1])*height]:[0,0,0,0];
    surfaces.push(...rect,...rect,...rect);surfaceUVs.push(...ta,...tb,...tc);
  };
  const segment=shape.segment,span=segment?Math.max(1,Math.hypot(segment.dx,segment.dy)):1;
  const distance=(a:Vertex,b:Vertex)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*(segment?segment.height/span:1),(a[2]-b[2])*(segment?segment.thickness/span:1));
  const quad=(a:Vertex,b:Vertex,c:Vertex,d:Vertex,patch:Patch)=>{
    // Convert surface lengths into source-patch repeats, including the atlas
    // frame's aspect. No subdivision, CPU painting or new texture upload.
    const px=Math.max(.001,(patch[2]-patch[0])*(segment?1:width)),py=Math.max(.001,(patch[3]-patch[1])*(segment?height/width:height));
    const rx=distance(a,b)/px,ry=distance(a,c)/py;
    tri(a,b,c,[0,0],[rx,0],[0,ry],patch);tri(b,d,c,[rx,0],[rx,ry],[0,ry],patch);
  };
  const polygon=(path:readonly Point[],z:number,patch:Patch)=>{
    const vectors=path.map(p=>new Vector2(p[0],p[1]));
    for(const face of ShapeUtils.triangulateShape(vectors,[])){
      let [a,b,c]=face;const pa=point(...path[a],z),pb=point(...path[b],z),pc=point(...path[c],z);
      if((pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0])>0)[b,c]=[c,b];
      const repeat=(p:Point):Point=>[p[0]/(patch[2]-patch[0]),(1-p[1])/(patch[3]-patch[1])];
      tri(point(...path[a],z),point(...path[b],z),point(...path[c],z),repeat(path[a]),repeat(path[b]),repeat(path[c]),patch);
    }
  };
  const extrude=(path:readonly Point[],back:number,roofEdges=0)=>{
    for(let i=0;i<path.length;i++){
      const a=path[i],b=path[(i+1)%path.length];
      quad(point(...a,0),point(...b,0),point(...a,back),point(...b,back),i<roofEdges?profile.tiles:profile.wall);
    }
    polygon(path,back,profile.wall);
  };
  const ROUND_SEGMENTS=32,centerZ=-depth/2;
  const foundationBottom=Math.max(...(profile.tiers??[]).map(t=>t.bottom),0);
  const circularPoint=(tier:Tier,angle:number,y:number):Vertex=>{
    const radius=(tier.right-tier.left)*width/2+inflate;
    return [left+(tier.left+tier.right)*width/2-.5+Math.sin(angle)*radius,.5-top-y*height,centerZ+Math.cos(angle)*radius];
  };
  const circularUV=(tier:Tier,angle:number,y:number):Point=>uv((tier.left+tier.right)/2+Math.sin(angle)*(tier.right-tier.left)*.46,y);
  const prism=(tier:Tier)=>{
    const patch=tier.patch??profile.wall,center:Vertex=[left+(tier.left+tier.right)*width/2-.5,.5-top-tier.top*height,centerZ];
    for(let i=0;i<ROUND_SEGMENTS;i++){
      const a=i/ROUND_SEGMENTS*Math.PI*2,b=(i+1)/ROUND_SEGMENTS*Math.PI*2;
      const bottom=tier.bottom===foundationBottom?Math.max(tier.bottom,shape.ground??tier.bottom):tier.bottom;
      const ab=circularPoint(tier,a,bottom),bb=circularPoint(tier,b,bottom),at=circularPoint(tier,a,tier.top),bt=circularPoint(tier,b,tier.top);
      // Reuse the authored facade on both halves of the actual cylinder.
      // The stone/timber fallback closes any transparent foliage/window edge.
      const ua=circularUV(tier,a,tier.bottom),ub=circularUV(tier,b,tier.bottom),va=circularUV(tier,a,tier.top),vb=circularUV(tier,b,tier.top);
      tri(ab,bb,at,ua,ub,va,patch,true);tri(bb,bt,at,ub,vb,va,patch,true);
      tri(center,at,bt,[.5,.5],[Math.sin(a)*2,Math.cos(a)*2],[Math.sin(b)*2,Math.cos(b)*2],patch);
    }
  };
  if(profile.curtain&&shape.segment){
    const box=(l:number,r:number,b:number,t:number)=>{
      quad([l,b,0],[r,b,0],[l,t,0],[r,t,0],profile.wall);
      quad([r,b,-1],[l,b,-1],[r,t,-1],[l,t,-1],profile.wall);
      quad([l,b,-1],[l,b,0],[l,t,-1],[l,t,0],profile.wall);
      quad([r,b,0],[r,b,-1],[r,t,0],[r,t,-1],profile.wall);
      quad([l,t,0],[r,t,0],[l,t,-1],[r,t,-1],profile.tiles);
    };
    box(-.5,.5,-.5,.30);
    const count=profile.id==='horizontal-curtain'?7:3,step=1/count;
    for(let i=0;i<count;i++)box(-.5+i*step,-.5+i*step+step*.57,.30,.5);
  }else{
    // Complete authored front, including windows, doors, flags and fine trim.
    if(!profile.tiers){
      tri([-.5,-.5,0],[.5,-.5,0],[-.5,.5,0],[0,0],[1,0],[0,1]);
      tri([.5,-.5,0],[.5,.5,0],[-.5,.5,0],[1,0],[1,1],[0,1]);
    }
    if(profile.tiers){
      for(const tier of profile.tiers)prism(tier);
      const hip=profile.hip;
      if(hip){
        const tier={left:hip.left,right:hip.right,top:hip.eave,bottom:hip.eave};
        const tip:Vertex=[left+(hip.left+hip.right)*width/2-.5,.5-top-hip.peak*height,centerZ];
        for(let i=0;i<ROUND_SEGMENTS;i++){
          const a=i/ROUND_SEGMENTS*Math.PI*2,b=(i+1)/ROUND_SEGMENTS*Math.PI*2;
          tri(circularPoint(tier,a,hip.eave),circularPoint(tier,b,hip.eave),tip,
            circularUV(tier,a,hip.eave),circularUV(tier,b,hip.eave),uv((hip.left+hip.right)/2,hip.peak),profile.tiles,true);
        }
        // Only the original flag/finial remains a slim, fixed surface above
        // the cone. The tower body and roof are never a rectangular card.
        const l=.35,r=.90,y=hip.peak,z=centerZ;
        tri(point(l,y,z),point(r,y,z),point(l,0,z),uv(l,y),uv(r,y),uv(l,0));
        tri(point(r,y,z),point(r,0,z),point(l,0,z),uv(r,y),uv(r,0),uv(l,0));
      }else{
        const crown=profile.tiers.reduce((a,b)=>b.top<a.top?b:a),w=crown.right-crown.left;
        const rim:Point[]=Array.from({length:12},(_,i)=>{
          const angle=i/12*Math.PI*2;
          return [(crown.left+crown.right)/2+Math.sin(angle)*w*.43,centerZ+Math.cos(angle)*w*width*.43];
        });
        for(const [x,z] of rim){
          const l=x-w*.065,r=x+w*.065,f=z+depth*.055,b=z-depth*.055,t=crown.top-.075,y=crown.top;
          quad(point(l,y,f),point(r,y,f),point(l,t,f),point(r,t,f),profile.wall);
          quad(point(r,y,b),point(l,y,b),point(r,t,b),point(l,t,b),profile.wall);
          quad(point(l,y,b),point(l,y,f),point(l,t,b),point(l,t,f),profile.wall);
          quad(point(r,y,f),point(r,y,b),point(r,t,f),point(r,t,b),profile.wall);
          quad(point(l,t,f),point(r,t,f),point(l,t,b),point(r,t,b),profile.tiles);
        }
      }
    }else if(profile.board){
      // Roof, notice panel and two independent posts; the gap below the
      // board stays open. The back uses wood, never mirrored paper notices.
      extrude([[.09,.23],[.91,.23],[.91,.77],[.09,.77]],-depth);
      extrude([[.13,.72],[.22,.72],[.22,.97],[.13,.97]],-depth);
      extrude([[.79,.72],[.88,.72],[.88,.97],[.79,.97]],-depth);
      const roof=profile.roof;extrude([...roof,[roof[roof.length-1][0],.25],[roof[0][0],.25]],-depth,roof.length-1);
    }else{
      const roof=profile.roof,first=roof[0],last=roof[roof.length-1],base=Math.max(.96,shape.ground??.96,...(profile.opening??[]).map(p=>p[1]));
      const path:Point[]=[...roof,[last[0],base],...(profile.opening??[]),[first[0],base]];
      extrude(path,-depth,roof.length-1);
      const window=houseWindows[profile.id];
      if((window||/smithy|stable/.test(profile.id))&&!profile.opening?.length){
        const eave=Math.max(first[1],last[1]),sill=eave+(base-eave)*.67,head=eave+(base-eave)*.22;
        const frame=.018,proud=.006,sideSpan=depth/width;
        const solidBox=(l:number,r:number,t:number,b:number,z:number,back:number,patch:Patch)=>{
          quad(point(l,b,z),point(r,b,z),point(l,t,z),point(r,t,z),patch);
          quad(point(r,b,back),point(l,b,back),point(r,t,back),point(l,t,back),patch);
          quad(point(l,b,back),point(l,b,z),point(l,t,back),point(l,t,z),patch);
          quad(point(r,b,z),point(r,b,back),point(r,t,z),point(r,t,back),patch);
          quad(point(l,t,z),point(r,t,z),point(l,t,back),point(r,t,back),patch);
        };
        // Foundation courses, corner framing and an eave fascia give the
        // formerly featureless elevations coherent depth and scale.
        solidBox(first[0]-.008,last[0]+.008,base-.065,base,-.003,-depth-proud,profile.wall);
        solidBox(first[0]-.014,first[0]+.014,eave,base,-.003,-depth-proud,profile.tiles);
        solidBox(last[0]-.014,last[0]+.014,eave,base,-.003,-depth-proud,profile.tiles);
        solidBox(first[0]-.018,last[0]+.018,eave-.018,eave+.018,-.003,-depth-proud,profile.tiles);
        const painted=(a:Vertex,b:Vertex,c:Vertex,d:Vertex)=>{
          if(!window)return;
          const [l,t,r,bottom]=window,aa=uv(l,bottom),bb=uv(r,bottom),cc=uv(l,t),dd=uv(r,t);
          tri(a,b,c,aa,bb,cc,profile.wall,true);tri(b,d,c,bb,dd,cc,profile.wall,true);
        };
        const count=Math.max(1,Math.min(3,Math.round((last[0]-first[0])/.30)));
        if(window)for(let i=0;i<count;i++){
          const cx=first[0]+(last[0]-first[0])*(i+.5)/count,half=Math.min(.085,(last[0]-first[0])/count*.25),l=cx-half,r=cx+half;
          painted(point(r,sill,-depth-.003),point(l,sill,-depth-.003),point(r,head,-depth-.003),point(l,head,-depth-.003));
          solidBox(l-frame,r+frame,sill,sill+.025,-depth-proud,-depth-proud*3,profile.wall);
          solidBox(l-frame,r+frame,head-.02,head,-depth-proud,-depth-proud*3,profile.tiles);
        }
        const sideCount=Math.max(1,Math.min(3,Math.round(sideSpan/.30)));
        const sidePoint=(x:number,y:number,z:number,dx:number):Vertex=>{const p=point(x,y,z);return [p[0]+dx,p[1],p[2]];};
        if(window)for(const x of [first[0],last[0]])for(let i=0;i<sideCount;i++){
          const z=-depth*(i+.5)/sideCount,half=Math.min(depth/sideCount*.27,width*.085),dx=x===first[0]?-proud:proud;
          painted(sidePoint(x,sill,z+half,dx),sidePoint(x,sill,z-half,dx),sidePoint(x,head,z+half,dx),sidePoint(x,head,z-half,dx));
          solidBox(x-frame,x+frame,sill,sill+.025,z+half+frame,z-half-frame,profile.wall);
          solidBox(x-frame,x+frame,head-.02,head,z+half+frame,z-half-frame,profile.tiles);
        }
        // The authored roof slopes keep their shape; raised ridge/eave strips
        // finish their seams instead of exposing raw extrusion edges.
        for(let i=1;i<roof.length-1;i++){
          const [x,y]=roof[i];solidBox(x-.009,x+.009,y-.010,y+.006,.003,-depth-.003,profile.tiles);
        }
      }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.setAttribute('surfaceRect',new Float32BufferAttribute(surfaces,4));
  geometry.setAttribute('surfaceUV',new Float32BufferAttribute(surfaceUVs,2));
  geometry.computeVertexNormals();return geometry;
}

/** Closed interior panels share original art and do not acquire town-wall
 * profiles. The existing crop/UV rectangle still limits each room segment. */
export function createWallGeometry(depth:number){
  const shape:HouseShape={profile:house('panel',[[0,0],[1,0]],[.05,.15,.12,.85],[.05,.15,.12,.85],depth),left:0,top:0,width:1,height:1,depth};
  return createHouseGeometry(shape);
}
