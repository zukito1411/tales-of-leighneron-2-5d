import {TOWN_BY_ID} from './towns';
import {artFrameSize,ART_BY_KEY} from './art';
import type {PropContentDefinition,Vec2} from '../game/types';
import {outerFortificationBlocksPoint,outerFortificationBlocksPath,CurtainCollision,ROYAL_GATE_OPENING,type CurtainLine} from './settlementDefenses';
import {fortificationSize} from './settlementPlanning';
import {HIGHMERE_PLAN,HIGHMERE_ROYAL_GATE_Y,HIGHMERE_ROYAL_POSTERN_Y,ringVertices} from './highmerePlan';

// The raised royal ward is a true ring. Gates, mesh runs and collision share
// exact surveyed endpoints; no bounding rectangle becomes an invisible wall.
const town=TOWN_BY_ID.highmere,city=town.world;
const size=fortificationSize(town),world=(x:number,y:number):Vec2=>({x:city.x+x,y:city.y+y});
const localVertices=ringVertices(HIGHMERE_PLAN.royalCenter,HIGHMERE_PLAN.royalRadius,HIGHMERE_PLAN.royalSegments);
const vertices=localVertices.map(p=>world(p.x,p.y));
const gate=world(0,HIGHMERE_ROYAL_GATE_Y),gateScale=3.1;
export const ROYAL_WALL_LINES:Array<CurtainLine&{frame:number}>=[];
for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length];
  const gateEdge=Math.abs(a.y-b.y)<.01&&(Math.abs(a.y-gate.y)<.01||Math.abs(a.y-city.y-HIGHMERE_ROYAL_POSTERN_Y)<.01);
  const add=(from:Vec2,to:Vec2)=>ROYAL_WALL_LINES.push({a:from,b:to,townId:town.id,frame:2,thickness:size.thickness});
  if(gateEdge){const left=a.x<b.x?a:b,right=a.x<b.x?b:a;
    add(left,{x:city.x+ROYAL_GATE_OPENING.left,y:a.y});add({x:city.x+ROYAL_GATE_OPENING.right,y:a.y},right);
  }else add(a,b);
}

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
ROYAL_FORTIFICATION_PROPS.push({id:'fort:highmere:north-postern',kind:'prop',world:world(0,HIGHMERE_ROYAL_POSTERN_Y),texture:'royal_walls',frame:5,scale:gateScale,solid:false,anchor:'center',label:'Royal Garden Postern'});
const towerScale=size.towerDiameter/(artFrameSize('royal_walls',3).width*.78);
for(const [i,p] of vertices.entries())if(i%4===0)ROYAL_FORTIFICATION_PROPS.push({id:'fort:highmere:corner:'+(i/4),kind:'prop',world:p,texture:'royal_walls',frame:3,scale:towerScale,solid:true,anchor:'center'});

const royalCollision=new CurtainCollision(ROYAL_WALL_LINES);
export function fortificationBlocksPoint(x:number,y:number,radius=12){
  return outerFortificationBlocksPoint(x,y,radius)||royalCollision.blocksPoint(x,y,radius);
}
export function fortificationBlocksPath(a:Vec2,b:Vec2,radius=0){
  return outerFortificationBlocksPath(a,b,radius)||royalCollision.blocksPath(a,b,radius);
}
