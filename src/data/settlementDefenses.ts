import {TOWNS,TOWN_BY_ID} from './towns';
import {SETTLEMENT_PROFILES,type SettlementProfileId} from './settlementProfiles';
import {ROAD_ROUTES} from './roadRoutes';
import {ART_BY_KEY,artFrameSize} from './art';
import type {PropContentDefinition,Vec2} from '../game/types';
import {HIGHMERE_RIVER} from './rivers';

export interface CurtainLine {a:Vec2;b:Vec2;townId:string;gateShoulder?:boolean}
export interface DefensiveEntrance {id:string;townId:string;point:Vec2;width:number;kind:'road'|'water';northSouth:boolean;gateArtwork?:boolean}
export interface DefensiveSurvey {townId:string;vertices:Vec2[];lines:CurtainLine[];entrances:DefensiveEntrance[];approaches:Vec2[][]}
const fit=artFrameSize('royal_walls',0).width/ART_BY_KEY.royal_walls.regions![0][2];
// The open artwork needs enough aperture for a road cart, not just one person.
const gateScale=3.1,gateHalfOpening=59*fit*gateScale/2;
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
export function curtainBlocksPath(a:Vec2,b:Vec2,line:CurtainLine,radius=0) {
  const pad=radius+9;
  if(Math.max(a.x,b.x)<Math.min(line.a.x,line.b.x)-pad||Math.min(a.x,b.x)>Math.max(line.a.x,line.b.x)+pad
    ||Math.max(a.y,b.y)<Math.min(line.a.y,line.b.y)-pad||Math.min(a.y,b.y)>Math.max(line.a.y,line.b.y)+pad)return false;
  return Boolean(intersection(a,b,line.a,line.b))||Math.min(distance(a,line.a,line.b),distance(b,line.a,line.b),distance(line.a,a,b),distance(line.b,a,b))<pad;
}

/** Six-sided surveyed enclosure: real horizontal and ±1:2 diagonal source
 * sections, never rotated fake vertical walls. Expanded flank courts contain
 * the full authored rectangular settlement and its agricultural frontage. */
export const SETTLEMENT_DEFENSES:DefensiveSurvey[]=TOWNS.map(town=>{
  const profile=SETTLEMENT_PROFILES[town.id as SettlementProfileId],hx=profile.bounds.width/2+160,hy=profile.bounds.height/2+160;
  const point=(x:number,y:number):Vec2=>({x:town.world.x+x,y:town.world.y+y});
  const vertices=[point(-hx,-hy),point(hx,-hy),point(hx+2*hy,0),point(hx,hy),point(-hx,hy),point(-hx-2*hy,0)];
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
      if(hit)add(hit,route.width+88,'road',edge===0||edge===3);
    }
  const northX=town.id==='highmere'?1400:town.id==='oakmere'?-550:0,southX=town.id==='highmere'?-600:0;
  const north=point(northX,-hy),south=point(southX,hy);
  const gateWidth=town.id==='highmere'?500:town.id==='blackspire'?260:170;
  add(north,gateWidth,'road',true);add(south,gateWidth,town.kind==='harbor'?'water':'road',true);
  if(town.id==='highmere'){
    entrances.filter(e=>Math.hypot(e.point.x-north.x,e.point.y-north.y)<1||Math.hypot(e.point.x-south.x,e.point.y-south.y)<1).forEach(e=>{e.gateArtwork=true;});
    approaches.push([point(850,-1200),point(850,-2400),point(1400,-2400),north],[point(-600,2250),south]);
  }
  else if(town.id==='oakmere')approaches.push([point(-550,-120),north],[point(0,720),south]);
  else {approaches.push([point(0,0),north]);if(town.kind!=='harbor')approaches.push([point(0,0),south]);}
  // Defended water ports are intentional openings, not walls across a river.
  const riverX=town.id==='highmere'?null:town.id==='willowcross'?600:town.id==='deepford'?450:null;
  if(riverX!==null){add(point(riverX,-hy),220,'water',true);add(point(riverX,hy),220,'water',true);}
  if(town.id==='highmere')for(const localY of [-hy,hy]){
    const y=town.world.y+localY,i=HIGHMERE_RIVER.points.slice(1).findIndex((b,j)=>y>=Math.min(HIGHMERE_RIVER.points[j].y,b.y)&&y<=Math.max(HIGHMERE_RIVER.points[j].y,b.y));
    if(i>=0){const a=HIGHMERE_RIVER.points[i],b=HIGHMERE_RIVER.points[i+1];add({x:a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y),y},220,'water',true);}
  }
  if(town.kind==='harbor')add(point(700,hy),220,'water',true);
  const lines:CurtainLine[]=[];
  for(let edge=0;edge<vertices.length;edge++){
    const a=vertices[edge],b=vertices[(edge+1)%vertices.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const gaps=entrances.filter(e=>distance(e.point,a,b)<2).map(e=>{
      const center=Math.hypot(e.point.x-a.x,e.point.y-a.y)/length,half=e.width/2/length;
      return {lo:Math.max(0,center-half),hi:Math.min(1,center+half)};
    }).sort((p,q)=>p.lo-q.lo);
    let cursor=0;const between=(lo:number,hi:number)=>{if(hi-lo<.00001)return;lines.push({townId:town.id,
      a:{x:a.x+(b.x-a.x)*lo,y:a.y+(b.y-a.y)*lo},b:{x:a.x+(b.x-a.x)*hi,y:a.y+(b.y-a.y)*hi}});};
    for(const gap of gaps){between(cursor,gap.lo);cursor=Math.max(cursor,gap.hi);}between(cursor,1);
  }
  for(const entrance of entrances.filter(e=>e.gateArtwork)) {
    lines.push({townId:town.id,gateShoulder:true,a:{x:entrance.point.x-entrance.width/2,y:entrance.point.y},b:{x:entrance.point.x-gateHalfOpening,y:entrance.point.y}},
      {townId:town.id,gateShoulder:true,a:{x:entrance.point.x+gateHalfOpening,y:entrance.point.y},b:{x:entrance.point.x+entrance.width/2,y:entrance.point.y}});
  }
  return {townId:town.id,vertices,lines,entrances,approaches};
});
export const DEFENSE_BY_ID=Object.fromEntries(SETTLEMENT_DEFENSES.map(d=>[d.townId,d])) as Record<string,DefensiveSurvey>;
const defenseBounds=SETTLEMENT_DEFENSES.map(defense=>({defense,
  left:Math.min(...defense.vertices.map(p=>p.x)),right:Math.max(...defense.vertices.map(p=>p.x)),
  top:Math.min(...defense.vertices.map(p=>p.y)),bottom:Math.max(...defense.vertices.map(p=>p.y))}));
export function insideDefense(townId:string,x:number,y:number,buffer=0) {
  const town=TOWN_BY_ID[townId];const profile=SETTLEMENT_PROFILES[townId as SettlementProfileId];
  if(!town||!profile)return false;
  const hx=profile.bounds.width/2+160+buffer,hy=profile.bounds.height/2+160+buffer,dx=Math.abs(x-town.world.x),dy=Math.abs(y-town.world.y);
  return dy<=hy&&dx<=hx+2*(hy-dy);
}
export function outerFortificationBlocksPoint(x:number,y:number,radius=12) {
  const pad=radius+9;
  return defenseBounds.some(bounds=>x>=bounds.left-pad&&x<=bounds.right+pad&&y>=bounds.top-pad&&y<=bounds.bottom+pad
    &&bounds.defense.lines.some(line=>distance({x,y},line.a,line.b)<pad));
}
export function outerFortificationBlocksPath(a:Vec2,b:Vec2,radius=0) {
  const pad=radius+9,left=Math.min(a.x,b.x)-pad,right=Math.max(a.x,b.x)+pad,top=Math.min(a.y,b.y)-pad,bottom=Math.max(a.y,b.y)+pad;
  return defenseBounds.some(bounds=>left<=bounds.right&&right>=bounds.left&&top<=bounds.bottom&&bottom>=bounds.top
    &&bounds.defense.lines.some(line=>curtainBlocksPath(a,b,line,radius)));
}
export const SETTLEMENT_DEFENSE_PROPS:PropContentDefinition[]=[];
for(const defense of SETTLEMENT_DEFENSES){const town=TOWNS.find(t=>t.id===defense.townId)!,profile=SETTLEMENT_PROFILES[town.id as SettlementProfileId];
  const baseScale=town.id==='highmere'?1.35:town.kind==='village' ? .75 : 1;
  for(const [edge,line] of defense.lines.entries()){
    if(line.gateShoulder)continue;
    const a=line.a.x<=line.b.x?line.a:line.b,b=line.a.x<=line.b.x?line.b:line.a;
    const frame=Math.abs(b.y-a.y)<1?2:b.y<a.y?0:1,sourceSpan=frame===2?285:frame===0?94:90;
    const count=Math.max(1,Math.round((b.x-a.x)/(sourceSpan*fit*baseScale))),scale=(b.x-a.x)/count/sourceSpan/fit;
    for(let i=0;i<count;i++)SETTLEMENT_DEFENSE_PROPS.push({id:`defense:${town.id}:curtain:${edge}:${i}`,kind:'prop',texture:'royal_walls',frame,scale,solid:false,anchor:'center',tint:profile.wallTint,
      wallSegment:{dx:(b.x-a.x)/count,dy:(b.y-a.y)/count},
      world:{x:a.x+(b.x-a.x)*(i+.5)/count,y:a.y+(b.y-a.y)*(i+.5)/count}});
  }
  for(const [i,point] of defense.vertices.entries()){
    const towerScale=baseScale*1.15,clearance=artFrameSize('royal_walls',3).width*towerScale/2+24;
    // Side roads can enter exactly at a perimeter vertex. The opening cuts
    // both adjacent curtains; a corner tower must not fill that opening again.
    if(defense.entrances.some(e=>Math.hypot(e.point.x-point.x,e.point.y-point.y)<e.width/2+clearance))continue;
    SETTLEMENT_DEFENSE_PROPS.push({id:`defense:${town.id}:tower:${i}`,kind:'prop',texture:'royal_walls',frame:3,scale:towerScale,solid:true,footprint:{width:57.5*baseScale,height:27.6*baseScale},anchor:'center',world:point,tint:profile.wallTint});
  }
  for(const entrance of defense.entrances) {
    if(entrance.gateArtwork)SETTLEMENT_DEFENSE_PROPS.push({id:entrance.id+':gatehouse',kind:'prop',world:entrance.point,texture:'royal_walls',frame:5,scale:gateScale,solid:false,anchor:'center',tint:profile.wallTint,label:entrance.point.y<town.world.y?'Highmere North Gate':'Highmere South Gate'});
    // Open side passages end at the actual cut curtains. Do not add round
    // towers on an extrapolated edge, or duplicate the gate sprite's posts.
  }
}
