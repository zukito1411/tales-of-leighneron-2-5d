import {TOWNS,TOWN_BY_ID} from './towns';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {SETTLEMENT_PROFILES,type SettlementProfileId} from './settlementProfiles';
import {ROAD_ROUTES} from './roadRoutes';
import {ART_BY_KEY,artFrameSize} from './art';
import {architectureProfile,architecturePassageFootprints} from './architecture';
import type {PropContentDefinition,Vec2} from '../game/types';
import {HIGHMERE_RIVER} from './rivers';
import {settlementEnvelope,settlementGroundPlan,settlementNorthBoundary,fortificationSize} from './settlementPlanning';
import {harborBay} from './worldLandscape';
import {HIGHMERE_AVENUES,HIGHMERE_ROYAL_POSTERN_Y,insideHighmere} from './highmerePlan';

export interface CurtainLine {a:Vec2;b:Vec2;townId:string;gateShoulder?:boolean;thickness?:number;sourceIndex?:number;shorePart?:number}
export interface DefensiveEntrance {id:string;townId:string;point:Vec2;width:number;kind:'road'|'water';northSouth:boolean;gateArtwork?:boolean}
export interface DefensiveSurvey {townId:string;vertices:Vec2[];lines:CurtainLine[];entrances:DefensiveEntrance[];approaches:Vec2[][]}
const fit=artFrameSize('royal_walls',0).width/ART_BY_KEY.royal_walls.regions![0][2];
// The open artwork needs enough aperture for a road cart, not just one person.
const gateScale=3.1;
const gateRegion=ART_BY_KEY.royal_walls.regions![5],gateAnchor=ART_BY_KEY.royal_walls.groundPoints![5];
const gateSourceX=(gateAnchor[0]-gateRegion[0])/gateRegion[2],gateWidth=artFrameSize('royal_walls',5).width*gateScale;
const gatePillars=architecturePassageFootprints(architectureProfile('royal_walls',5)!)!;
// Curtain ends and gate supports use the same model aperture and foot anchor.
export const ROYAL_GATE_OPENING={left:(gatePillars[0].right-gateSourceX)*gateWidth,right:(gatePillars[1].left-gateSourceX)*gateWidth};
const distance=(p:Vec2,a:Vec2,b:Vec2)=>{
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
function intersection(a:Vec2,b:Vec2,c:Vec2,d:Vec2) {
  const dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,det=dx*ey-dy*ex;
  if(Math.abs(det)<.00001)return null;
  const px=c.x-a.x,py=c.y-a.y,t=(px*ey-py*ex)/det,u=(px*dy-py*dx)/det;
  return t>=0&&t<=1&&u>=0&&u<=1?{x:a.x+dx*t,y:a.y+dy*t,t,u}:null;
}
/** The rendered curtain has flat ends. A capsule would extend half its
 * thickness into every gate opening, creating invisible blocks past the mesh. */
export function curtainBlocksPoint(x:number,y:number,line:CurtainLine,radius=0){
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,length=Math.hypot(dx,dy);if(length<.001)return false;
  const along=((x-line.a.x)*dx+(y-line.a.y)*dy)/length;
  const across=(-(x-line.a.x)*dy+(y-line.a.y)*dx)/length;
  return along>=-radius&&along<=length+radius&&Math.abs(across)<=(line.thickness??18)/2+radius;
}
export function curtainBlocksPath(a:Vec2,b:Vec2,line:CurtainLine,radius=0){
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,length=Math.hypot(dx,dy);if(length<.001)return false;
  const ux=dx/length,uy=dy/length,half=(line.thickness??18)/2+radius;
  const x=(a.x-line.a.x)*ux+(a.y-line.a.y)*uy,y=-(a.x-line.a.x)*uy+(a.y-line.a.y)*ux;
  const vx=(b.x-a.x)*ux+(b.y-a.y)*uy,vy=-(b.x-a.x)*uy+(b.y-a.y)*ux;
  let enter=0,leave=1;
  if(Math.abs(vx)<.00001){if(x< -radius||x>length+radius)return false;}
  else{const t0=(-radius-x)/vx,t1=(length+radius-x)/vx;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));}
  if(Math.abs(vy)<.00001){if(y< -half||y>half)return false;}
  else{const t0=(-half-y)/vy,t1=(half-y)/vy;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));}
  return enter<=leave;
}

/** Immutable segment bounds, shared by outer and inner defensive rings. */
export class CurtainCollision {
  private readonly index:StaticBoundsIndex<{bounds:{left:number;right:number;top:number;bottom:number};line:CurtainLine}>;
  private readonly query={left:0,right:0,top:0,bottom:0};
  constructor(lines:readonly CurtainLine[]){
    this.index=new StaticBoundsIndex(lines.map(line=>{const pad=(line.thickness??18)/2;return {line,bounds:{
      left:Math.min(line.a.x,line.b.x)-pad,right:Math.max(line.a.x,line.b.x)+pad,
      top:Math.min(line.a.y,line.b.y)-pad,bottom:Math.max(line.a.y,line.b.y)+pad}};}));
  }
  blocksPoint(x:number,y:number,radius=0){
    const q=this.query,pad=radius*Math.SQRT2;q.left=x-pad-.001;q.right=x+pad+.001;q.top=y-pad-.001;q.bottom=y+pad+.001;
    return this.index.any(q,entry=>curtainBlocksPoint(x,y,entry.line,radius));
  }
  blocksPath(a:Vec2,b:Vec2,radius=0){
    const q=this.query,pad=radius*Math.SQRT2;q.left=Math.min(a.x,b.x)-pad-.001;q.right=Math.max(a.x,b.x)+pad+.001;
    q.top=Math.min(a.y,b.y)-pad-.001;q.bottom=Math.max(a.y,b.y)+pad+.001;
    return this.index.any(q,entry=>curtainBlocksPath(a,b,entry.line,radius));
  }
}

function dryHarborFoundation(x:number,y:number,clearance:number){
  return !harborBay(x,y)&&!harborBay(x-clearance,y-clearance)&&!harborBay(x+clearance,y-clearance)
    &&!harborBay(x-clearance,y+clearance)&&!harborBay(x+clearance,y+clearance);
}
/** Clip the surveyed perimeter once, before both scenery and collision are
 * generated. Harbor water overrides the rectangular town foundation, so a
 * gate-sized gap alone cannot keep the rest of a sea-facing curtain dry. */
function shoreCurtain(line:CurtainLine,sourceIndex:number):CurtainLine[]{
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,length=Math.hypot(dx,dy),steps=Math.max(1,Math.ceil(length/32));
  const dry=(t:number)=>dryHarborFoundation(line.a.x+dx*t,line.a.y+dy*t,48);
  const pieces:CurtainLine[]=[];
  const add=(from:number,to:number)=>{
    if((to-from)*length<32)return;
    pieces.push({...line,sourceIndex,shorePart:pieces.length,
      a:{x:line.a.x+dx*from,y:line.a.y+dy*from},b:{x:line.a.x+dx*to,y:line.a.y+dy*to}});
  };
  let previous=0,wasDry=dry(0),start=0;
  for(let i=1;i<=steps;i++){
    const t=i/steps,isDry=dry(t);
    if(isDry!==wasDry){
      let lo=previous,hi=t;
      for(let n=0;n<16;n++){const middle=(lo+hi)/2;if(dry(middle)===wasDry)lo=middle;else hi=middle;}
      if(wasDry)add(start,lo);else start=hi;
    }
    wasDry=isDry;previous=t;
  }
  if(wasDry)add(start,1);
  return pieces;
}

/** Rectangular settlement blocks follow the same plan as roads and foundations.
 * Source artwork supplies materials; real 3D runs can face either street axis. */
export const SETTLEMENT_DEFENSES:DefensiveSurvey[]=TOWNS.map(town=>{
  const bounds=settlementEnvelope(town),size=fortificationSize(town);
  const point=(x:number,y:number):Vec2=>({x:town.world.x+x,y:town.world.y+y});
  const vertices=settlementGroundPlan(town).vertices.map(p=>point(p.x,p.y));
  const entrances:DefensiveEntrance[]=[],approaches:Vec2[][]=[];
  const add=(p:Vec2,width:number,kind:'road'|'water',northSouth:boolean)=>{
    const edgeOf=(q:Vec2)=>vertices.findIndex((a,i)=>distance(q,a,vertices[(i+1)%vertices.length])<2);
    const existing=entrances.find(e=>e.kind===kind&&edgeOf(e.point)===edgeOf(p)
      &&Math.hypot(e.point.x-p.x,e.point.y-p.y)<(e.width+width)/2);
    if(existing){const dx=p.x-existing.point.x,dy=p.y-existing.point.y,d=Math.hypot(dx,dy);
      if(d<1){existing.width=Math.max(existing.width,width);return;}
      const lo=Math.min(-existing.width/2,d-width/2),hi=Math.max(existing.width/2,d+width/2),shift=(lo+hi)/2;
      existing.point={x:existing.point.x+dx/d*shift,y:existing.point.y+dy/d*shift};existing.width=hi-lo;return;
    }
    entrances.push({id:`defense:${town.id}:entrance:${entrances.length}`,townId:town.id,point:p,width,kind,northSouth});
  };
  // Actual regional travel routes determine their crossings, not arbitrary gates.
  for(const route of ROAD_ROUTES.filter(r=>r.from===town.id||r.to===town.id))for(let i=1;i<route.points.length;i++)
    for(let edge=0;edge<vertices.length;edge++){
      const hit=intersection(route.points[i-1],route.points[i],vertices[edge],vertices[(edge+1)%vertices.length]);
      if(hit)add(hit,route.width+88,'road',Math.abs(vertices[edge].y-vertices[(edge+1)%vertices.length].y)<1);
    }
  const northX=town.id==='oakmere'?-550:0,southX=0;
  const north=point(northX,settlementNorthBoundary(town,northX)),south=point(southX,bounds.bottom);
  const gateWidth=town.id==='highmere'?500:town.id==='blackspire'?260:170;
  add(north,gateWidth,'road',true);add(south,gateWidth,town.kind==='harbor'?'water':'road',true);
  if(town.id==='highmere'){
    entrances.filter(e=>Math.hypot(e.point.x-north.x,e.point.y-north.y)<1||Math.hypot(e.point.x-south.x,e.point.y-south.y)<1).forEach(e=>{e.gateArtwork=true;});
    approaches.push([point(0,HIGHMERE_ROYAL_POSTERN_Y),north],[point(0,0),south,point(0,7600)]);
    // Only surveyed public streets cut the ring; the quay road stays outside
    // and shares the single eastern gate with the regional trade route.
    for(const road of HIGHMERE_AVENUES)for(let i=1;i<road.points.length;i++)for(let edge=0;edge<vertices.length;edge++){
      const hit=intersection(point(road.points[i-1].x,road.points[i-1].y),point(road.points[i].x,road.points[i].y),vertices[edge],vertices[(edge+1)%vertices.length]);
      if(hit)add(hit,road.width+88,'road',Math.abs(vertices[edge].y-vertices[(edge+1)%vertices.length].y)<1);
    }
    const east=entrances.find(e=>e.kind==='road'&&e.point.x>town.world.x+5000&&Math.abs(e.point.y-town.world.y)<1);
    if(east){east.width=Math.max(east.width,500);east.gateArtwork=true;}
  }
  else if(town.id==='oakmere')approaches.push([point(-550,-120),north],[point(0,720),south]);
  else {approaches.push([point(0,0),north]);if(town.kind!=='harbor')approaches.push([point(0,0),south]);}
  // Defended water ports are intentional openings, not walls across a river.
  const riverX=town.id==='highmere'?null:town.id==='willowcross'?600:town.id==='deepford'?450:null;
  if(riverX!==null){add(point(riverX,settlementNorthBoundary(town,riverX)),220,'water',true);add(point(riverX,bounds.bottom),220,'water',true);}
  if(town.id==='highmere')for(let river=1;river<HIGHMERE_RIVER.points.length;river++)for(let edge=0;edge<vertices.length;edge++){
    const a=vertices[edge],b=vertices[(edge+1)%vertices.length];
    const hit=intersection(HIGHMERE_RIVER.points[river-1],HIGHMERE_RIVER.points[river],a,b);
    if(hit)add(hit,220,'water',Math.abs(a.y-b.y)<1);
  }
  if(town.kind==='harbor')add(point(700,bounds.bottom),220,'water',true);
  const lines:CurtainLine[]=[];
  for(let edge=0;edge<vertices.length;edge++){
    const a=vertices[edge],b=vertices[(edge+1)%vertices.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const gaps=entrances.filter(e=>distance(e.point,a,b)<2).map(e=>{
      const center=Math.hypot(e.point.x-a.x,e.point.y-a.y)/length,half=e.width/2/length;
      return {lo:Math.max(0,center-half),hi:Math.min(1,center+half)};
    }).sort((p,q)=>p.lo-q.lo);
    let cursor=0;const between=(lo:number,hi:number)=>{if(hi-lo<.00001)return;lines.push({townId:town.id,thickness:size.thickness,
      a:{x:a.x+(b.x-a.x)*lo,y:a.y+(b.y-a.y)*lo},b:{x:a.x+(b.x-a.x)*hi,y:a.y+(b.y-a.y)*hi}});};
    for(const gap of gaps){between(cursor,gap.lo);cursor=Math.max(cursor,gap.hi);}between(cursor,1);
  }
  for(const entrance of entrances.filter(e=>e.gateArtwork)) {
    const along=(n:number)=>entrance.northSouth?{x:entrance.point.x+n,y:entrance.point.y}:{x:entrance.point.x,y:entrance.point.y+n};
    lines.push({townId:town.id,gateShoulder:true,thickness:size.thickness,a:along(-entrance.width/2),b:along(ROYAL_GATE_OPENING.left)},
      {townId:town.id,gateShoulder:true,thickness:size.thickness,a:along(ROYAL_GATE_OPENING.right),b:along(entrance.width/2)});
  }
  return {townId:town.id,vertices,lines:town.kind==='harbor'?lines.flatMap(shoreCurtain):lines,entrances,approaches};
});
export const DEFENSE_BY_ID=Object.fromEntries(SETTLEMENT_DEFENSES.map(d=>[d.townId,d])) as Record<string,DefensiveSurvey>;
const defenseBounds=SETTLEMENT_DEFENSES.map(defense=>({defense,
  areas:settlementGroundPlan(TOWN_BY_ID[defense.townId]).rectangles.map(r=>{
    const world=TOWN_BY_ID[defense.townId].world;
    return {left:r.left+world.x,right:r.right+world.x,top:r.top+world.y,bottom:r.bottom+world.y};
  }),
  halfThickness:fortificationSize(TOWN_BY_ID[defense.townId]).thickness/2,
  left:Math.min(...defense.vertices.map(p=>p.x)),right:Math.max(...defense.vertices.map(p=>p.x)),
  top:Math.min(...defense.vertices.map(p=>p.y)),bottom:Math.max(...defense.vertices.map(p=>p.y))}));
const defenseBoundsById=new Map(defenseBounds.map(bounds=>[bounds.defense.townId,bounds]));
export function insideDefense(townId:string,x:number,y:number,buffer=0) {
  const bounds=defenseBoundsById.get(townId);if(!bounds)return false;
  if(townId==='highmere'){const city=TOWN_BY_ID.highmere.world;return insideHighmere(x-city.x,y-city.y,buffer);}
  return bounds.areas.some(area=>x>=area.left-buffer&&x<=area.right+buffer&&y>=area.top-buffer&&y<=area.bottom+buffer);
}
const outerCollision=new CurtainCollision(SETTLEMENT_DEFENSES.flatMap(d=>d.lines));
export function outerFortificationBlocksPoint(x:number,y:number,radius=12){return outerCollision.blocksPoint(x,y,radius);}
export function outerFortificationBlocksPath(a:Vec2,b:Vec2,radius=0){return outerCollision.blocksPath(a,b,radius);}
export const SETTLEMENT_DEFENSE_PROPS:PropContentDefinition[]=[];
for(const defense of SETTLEMENT_DEFENSES){const town=TOWNS.find(t=>t.id===defense.townId)!,profile=SETTLEMENT_PROFILES[town.id as SettlementProfileId];
  const baseScale=town.id==='highmere'?1.35:town.kind==='village' ? .75 : 1,size=fortificationSize(town);
  for(const [edge,line] of defense.lines.entries()){
    if(line.gateShoulder)continue;
    const a=line.a,b=line.b,length=Math.hypot(b.x-a.x,b.y-a.y),frame=2,sourceSpan=285;
    const count=Math.max(1,Math.ceil(length/(sourceSpan*fit*baseScale))),scale=length/count/sourceSpan/fit;
    const section=line.sourceIndex??edge,part=line.shorePart?`:shore:${line.shorePart}`:'';
    for(let i=0;i<count;i++)SETTLEMENT_DEFENSE_PROPS.push({id:`defense:${town.id}:curtain:${section}:${i}${part}`,kind:'prop',texture:'royal_walls',frame,scale,solid:false,anchor:'center',tint:profile.wallTint,
      wallSegment:{dx:(b.x-a.x)/count,dy:(b.y-a.y)/count,height:size.height,thickness:size.thickness},
      world:{x:a.x+(b.x-a.x)*(i+.5)/count,y:a.y+(b.y-a.y)*(i+.5)/count}});
  }
  for(const [i,point] of defense.vertices.entries()){
    if(town.id==='highmere'&&i%4!==0)continue;
    const towerScale=size.towerDiameter/(artFrameSize('royal_walls',3).width*.78),clearance=size.towerDiameter/2+32;
    if(town.kind==='harbor'&&!dryHarborFoundation(point.x,point.y,clearance))continue;
    // Side roads can enter exactly at a perimeter vertex. The opening cuts
    // both adjacent curtains; a corner tower must not fill that opening again.
    if(defense.entrances.some(e=>Math.hypot(e.point.x-point.x,e.point.y-point.y)<e.width/2+clearance))continue;
    SETTLEMENT_DEFENSE_PROPS.push({id:`defense:${town.id}:tower:${i}`,kind:'prop',texture:'royal_walls',frame:3,scale:towerScale,solid:true,footprint:{width:57.5*baseScale,height:27.6*baseScale},anchor:'center',world:point,tint:profile.wallTint});
  }
  for(const entrance of defense.entrances) {
    if(entrance.gateArtwork)SETTLEMENT_DEFENSE_PROPS.push({id:entrance.id+':gatehouse',kind:'prop',world:entrance.point,texture:'royal_walls',frame:5,scale:gateScale,solid:false,anchor:'center',tint:profile.wallTint,rotation:entrance.northSouth?0:Math.PI/2,label:!entrance.northSouth?'Highmere Eastgate':entrance.point.y<town.world.y?'Highmere North Gate':'Highmere South Gate'});
    // Open side passages end at the actual cut curtains. Do not add round
    // towers on an extrapolated edge, or duplicate the gate sprite's posts.
  }
}
