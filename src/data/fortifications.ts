import {TOWN_BY_ID} from './towns';
import {artFrameSize,ART_BY_KEY} from './art';
import type {PropContentDefinition,Vec2} from '../game/types';
import {outerFortificationBlocksPoint,outerFortificationBlocksPath,curtainBlocksPath,curtainBlocksPoint,ROYAL_GATE_OPENING,type CurtainLine} from './settlementDefenses';
import {citadelPlanning,fortificationSize} from './settlementPlanning';

// The keep and its rectangular precinct share a surveyed court. Collision and
// complete 3D curtain runs use these same endpoints, including the gate opening.
const town=TOWN_BY_ID.highmere,city=town.world,court=citadelPlanning(town.id)!;
const size=fortificationSize(town),world=(x:number,y:number):Vec2=>({x:city.x+x,y:city.y+y});
const vertices=[world(court.left,court.top),world(court.right,court.top),world(court.right,court.bottom),world(court.left,court.bottom)];
const gate=world(court.x,court.bottom),gateScale=3.1;
export const ROYAL_WALL_LINES:Array<CurtainLine&{frame:number}>=[
  {a:vertices[0],b:vertices[1]}, {a:vertices[1],b:vertices[2]}, {a:vertices[3],b:vertices[0]},
  {a:vertices[3],b:world(court.x+ROYAL_GATE_OPENING.left,court.bottom)},
  {a:world(court.x+ROYAL_GATE_OPENING.right,court.bottom),b:vertices[2]},
].map(line=>({...line,townId:town.id,frame:2,thickness:size.thickness}));

export const ROYAL_FORTIFICATION_PROPS:PropContentDefinition[]=[];
const fit=artFrameSize('royal_walls',0).width/ART_BY_KEY.royal_walls.regions![0][2];
for(const [edge,line] of ROYAL_WALL_LINES.entries()){
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,length=Math.hypot(dx,dy),count=Math.max(1,Math.ceil(length/285));
  const scale=length/count/285/fit;
  for(let i=0;i<count;i++)ROYAL_FORTIFICATION_PROPS.push({
    id:edge<3?`fort:highmere:curtain:${edge}:${i}`:`fort:highmere:return:${edge-3}:${i}`,kind:'prop',
    world:{x:line.a.x+dx*(i+.5)/count,y:line.a.y+dy*(i+.5)/count},texture:'royal_walls',frame:2,scale,solid:false,anchor:'center',
    wallSegment:{dx:dx/count,dy:dy/count,height:size.height,thickness:size.thickness}});
}
ROYAL_FORTIFICATION_PROPS.push({id:'fort:highmere:south-gate',kind:'prop',world:gate,texture:'royal_walls',frame:5,scale:gateScale,solid:false,anchor:'center',label:'Royal Audience Gate'});
const towerScale=size.towerDiameter/(artFrameSize('royal_walls',3).width*.78);
for(const [i,p] of vertices.entries())ROYAL_FORTIFICATION_PROPS.push({id:'fort:highmere:corner:'+i,kind:'prop',world:p,texture:'royal_walls',frame:3,scale:towerScale,solid:true,anchor:'center'});

const left=city.x+court.left,right=city.x+court.right,top=city.y+court.top,bottom=city.y+court.bottom;
export function fortificationBlocksPoint(x:number,y:number,radius=12){
  if(outerFortificationBlocksPoint(x,y,radius))return true;
  const pad=radius+size.thickness/2;
  if(x<left-pad||x>right+pad||y<top-pad||y>bottom+pad)return false;
  return ROYAL_WALL_LINES.some(line=>curtainBlocksPoint(x,y,line,radius));
}
export function fortificationBlocksPath(a:Vec2,b:Vec2,radius=0){
  if(outerFortificationBlocksPath(a,b,radius))return true;
  const pad=radius+size.thickness/2;
  if(Math.max(a.x,b.x)<left-pad||Math.min(a.x,b.x)>right+pad
    ||Math.max(a.y,b.y)<top-pad||Math.min(a.y,b.y)>bottom+pad)return false;
  return ROYAL_WALL_LINES.some(line=>curtainBlocksPath(a,b,line,radius));
}
