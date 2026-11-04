import {TOWN_BY_ID} from './towns';
import {settlementGroundPlan,settlementEnvelope} from './settlementPlanning';
import {ROAD_ROUTES} from './roadRoutes';
import type {Rect} from './settlementGeometry';

const town=TOWN_BY_ID.elarion,origin=town.world;
const plan=settlementGroundPlan(town).rectangles,envelope=settlementEnvelope(town);
const summit=640,OUTER=4200;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const approaches=ROAD_ROUTES.filter(r=>r.from==='elarion'||r.to==='elarion');
export const ELARION_HIGHLAND_BOUNDS:Rect={left:origin.x+envelope.left-OUTER,right:origin.x+envelope.right+OUTER,
 top:origin.y+envelope.top-OUTER,bottom:origin.y+envelope.bottom+OUTER};
export function inElarionHighlands(x:number,y:number){const r=ELARION_HIGHLAND_BOUNDS;return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
function outsideSurvey(x:number,y:number){
 x-=origin.x;y-=origin.y;let d=Infinity;
 for(const r of plan)d=Math.min(d,Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom)));
 return d;
}
function approachDistance(x:number,y:number){
 let best=Infinity;
 for(const route of approaches)for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i];
  if(x<Math.min(a.x,b.x)-1100||x>Math.max(a.x,b.x)+1100||y<Math.min(a.y,b.y)-1100||y>Math.max(a.y,b.y)+1100)continue;
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
  best=Math.min(best,Math.hypot(x-a.x-t*dx,y-a.y-t*dy)-route.width/2);
 }
 return best;
}
/** The complete occupied survey (including the palace extension and wards)
 * stays level. Existing roads get broad continuous ascending grades. */
export function elarionElevation(x:number,y:number,natural:number){
 if(!inElarionHighlands(x,y))return natural;
 const d=outsideSurvey(x,y);if(d<=320)return summit;
 const weight=1-smooth((d-320)/(OUTER-320));if(weight<=0)return natural;
 const shoulder=190*(1-smooth((d-1100)/2700));
 const cliff=shoulder+(summit-shoulder)*(1-smooth((d-400)/700));
 const grade=summit*(1-smooth((d-320)/3600));
 const road=1-smooth((approachDistance(x,y)-280)/720);
 const hill=cliff+(grade-cliff)*road;
 return hill+natural*(1-weight);
}
export function elarionCliffTerrain(x:number,y:number){
 if(!inElarionHighlands(x,y))return false;
 const d=outsideSurvey(x,y);return d>400&&d<1120&&approachDistance(x,y)>400;
}
const snap=(n:number)=>Math.round(n/64)*64;
/** Two small woodland cascades, on the southern escarpment well away from
 * gates, roads, buildings and the life-tree court. Coordinates align to the
 * same 64-unit lattice as simulation/GPU terrain. */
export const ELARION_CASCADES=[-2304,2688].map((x,i)=>({id:'landscape:elarion:cascade:'+i,
 x:snap(origin.x+x),y:snap(origin.y+envelope.bottom+1216),width:256,run:960}));
export function elarionCascade(id:string){return ELARION_CASCADES.find(p=>p.id===id);}
