import { TOWN_BY_ID } from './towns';
import { artFrameSize, ART_BY_KEY } from './art';
import type { PropContentDefinition, Vec2 } from '../game/types';
import {outerFortificationBlocksPoint,outerFortificationBlocksPath,curtainBlocksPath} from './settlementDefenses';

// This is a complete royal precinct, not a fake rectangular city perimeter.
// Diagonal source sections keep their original perspective. The only gate is
// south-facing, in a joined horizontal curtain on the castle approach.
const city=TOWN_BY_ID.highmere.world;
const world=(x:number,y:number):Vec2=>({x:city.x+x,y:city.y+y});
const vertices=[world(-1000,-2300),world(200,-1700),world(-600,-1300),world(-1400,-1300),world(-2200,-1700)];
// Opening surveyed from the genuinely open lower-row gate (source x374–433).
const gate=world(-1000,-1300),gateScale=1.95,opening=59*artFrameSize('royal_walls',5).width/305*gateScale;
export const ROYAL_WALL_LINES=[
  {a:vertices[0],b:vertices[1],frame:1},{a:vertices[1],b:vertices[2],frame:0},
  {a:vertices[3],b:vertices[4],frame:0},{a:vertices[4],b:vertices[0],frame:0},
  {a:vertices[3],b:world(-1000-opening/2,-1300),frame:2},
  {a:world(-1000+opening/2,-1300),b:vertices[2],frame:2},
];
// Correct the west lower run: positive slope from the western tower to the
// south-west curtain corner. Never rotate a horizontal section into a side.
ROYAL_WALL_LINES[2]={a:vertices[4],b:vertices[3],frame:1};

export const ROYAL_FORTIFICATION_PROPS:PropContentDefinition[]=[];
const fit=artFrameSize('royal_walls',0).width/ART_BY_KEY.royal_walls.regions![0][2];
for(const [edge,line] of ROYAL_WALL_LINES.slice(0,4).entries()) {
  const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,count=Math.ceil(Math.abs(dx)/110);
  const sourceSpan=line.frame===0?94:90,scale=Math.abs(dx)/count/sourceSpan/fit;
  for(let i=0;i<count;i++)ROYAL_FORTIFICATION_PROPS.push({id:`fort:highmere:curtain:${edge}:${i}`,kind:'prop',
    world:{x:line.a.x+dx*(i+.5)/count,y:line.a.y+dy*(i+.5)/count},texture:'royal_walls',frame:line.frame,scale,solid:false,anchor:'center',wallSegment:{dx:dx/count,dy:dy/count}});
}
// Gate shoulders join short horizontal returns. Decorative ivy overlaps at
// the seams, but stone endpoints use the same ground line and uniform scale.
const shoulderSpan=285*fit*gateScale;
for(const [i,[a,b]] of [[-1400,-1000-shoulderSpan/2],[-1000+shoulderSpan/2,-600]].entries()) {
  const count=Math.ceil((b-a)/180),scale=(b-a)/count/285/fit;
  for(let j=0;j<count;j++)ROYAL_FORTIFICATION_PROPS.push({id:`fort:highmere:return:${i}:${j}`,kind:'prop',world:world(a+(b-a)*(j+.5)/count,-1300),texture:'royal_walls',frame:2,scale,solid:false,anchor:'center',wallSegment:{dx:(b-a)/count,dy:0}});
}
ROYAL_FORTIFICATION_PROPS.push({id:'fort:highmere:south-gate',kind:'prop',world:gate,texture:'royal_walls',frame:5,scale:gateScale,solid:false,anchor:'center',label:'Royal Audience Gate'});
for(const [i,p] of vertices.entries())ROYAL_FORTIFICATION_PROPS.push({id:'fort:highmere:corner:'+i,kind:'prop',world:p,texture:'royal_walls',frame:3,scale:1.3,solid:true,footprint:{width:65,height:31},anchor:'center'});

function distance(p:Vec2,a:Vec2,b:Vec2) {
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function fortificationBlocksPoint(x:number,y:number,radius=12) {
  if(outerFortificationBlocksPoint(x,y,radius))return true;
  if(Math.abs(x-city.x+1000)>1400||y<city.y-2400||y>city.y-1200)return false;
  return ROYAL_WALL_LINES.some(line=>distance({x,y},line.a,line.b)<radius+9);
}
export function fortificationBlocksPath(a:Vec2,b:Vec2,radius=0) {
  if(outerFortificationBlocksPath(a,b,radius))return true;
  if(Math.max(a.x,b.x)<city.x-2300-radius||Math.min(a.x,b.x)>city.x+300+radius
    ||Math.max(a.y,b.y)<city.y-2400-radius||Math.min(a.y,b.y)>city.y-1200+radius)return false;
  return ROYAL_WALL_LINES.some(line=>curtainBlocksPath(a,b,{...line,townId:'highmere'},radius));
}
