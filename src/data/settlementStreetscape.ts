import {settlementEnvelope} from './settlementPlanning';
import {registerSettlementPasture} from './settlementPastures';
import {streetStair} from './settlementStairs';
import type {ContentDefinition,PropContentDefinition,TownDefinition,Vec2,WorldPropTexture} from '../game/types';
import type {SettlementLayout} from './settlements';
import {TOWN_BY_ID} from './towns';
import {NPCS} from './npcs';
import {npcExteriorAnchors,npcStandingReservation} from './npcPositions';
import {INTERIOR_ASSIGNMENTS} from './interiorAssignments';
import {artFrameSize} from './art';
import {spriteBounds,propPlacementBounds,overlaps,rectTouchesStreet,type Rect} from './settlementGeometry';
import {worldSpriteProfile} from './worldSpriteGeometry';
import {insideDefense} from './settlementDefenses';
import {fortificationBlocksPoint} from './fortifications';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';
import {outdoorFittingBounds,outdoorDiningLayout} from './outdoorFurniture';
import {isTreeArt} from './treeArt';

const pad=(r:Rect,n:number):Rect=>({left:r.left-n,right:r.right+n,top:r.top-n,bottom:r.bottom+n});
const union=(a:Rect,b:Rect):Rect=>({left:Math.min(a.left,b.left),right:Math.max(a.right,b.right),top:Math.min(a.top,b.top),bottom:Math.max(a.bottom,b.bottom)});
export interface StreetscapeSummary {townId:string;added:number;omitted:number}
export const SETTLEMENT_STREETSCAPES:StreetscapeSummary[]=[];
/** Fit small, purposeful compositions into the FINAL survey. Stable IDs and
 * admitted story/service objects never move. No work from this pass runs per frame. */
export function addSettlementStreetscape(layouts:readonly SettlementLayout[],content:ContentDefinition[],walkable:(x:number,y:number)=>boolean,heightAt:(x:number,y:number)=>number=()=>0){
 if(content.some(d=>d.id.startsWith('detail:')&&d.id.includes(':beautify:')))return;
 const buildings=content.filter((d):d is PropContentDefinition=>d.kind==='settlement-prop'&&d.id.includes(':building:'));
 const indoors=new Set(INTERIOR_ASSIGNMENTS.map(([id])=>id));
 const boundsOf=(d:ContentDefinition):Rect|undefined=>{
  if(!('frame' in d))return;
  const stair=streetStair(d.id);if(stair)return {left:d.world.x-stair.width/2,right:d.world.x+stair.width/2,top:d.world.y-stair.run,bottom:d.world.y};
  const texture=d.texture??'world_objects',scale=d.scale??.6;
  if(worldSpriteProfile(texture,d.frame)?.floor)return;
  const dining=outdoorFittingBounds(d.id,d.world.x,d.world.y,artFrameSize(texture,d.frame).width*scale,d.rotation??0);
  if(dining)return dining;
  const ground=propPlacementBounds(texture,d.frame,scale,d.world.x,d.world.y,d.anchor==='center','wallSegment' in d?d.wallSegment:undefined,d.rotation??0);
  return isTreeArt(texture,d.frame)?union(ground,spriteBounds(texture,d.frame,scale,d.world.x,d.world.y)):ground;
 };
 const occupied=new StaticBoundsIndex(content.flatMap(d=>{const bounds=boundsOf(d);return bounds?[{bounds}]:[];}));
 const reserved:Array<{bounds:Rect}>=[];
 for(const d of content){
  if(d.kind==='npc'||d.kind==='creature'){
   if(d.kind==='creature'){const radius=d.bossId?600:180;reserved.push({bounds:{left:d.world.x-radius,right:d.world.x+radius,top:d.world.y-radius,bottom:d.world.y+radius}});}
   else if(!indoors.has(d.npcId))reserved.push({bounds:npcStandingReservation(d.world)});
  }else if('description' in d){
   // An interactable needs an approach, not just an empty pixel under its icon.
   reserved.push({bounds:{left:d.world.x-100,right:d.world.x+100,top:d.world.y-40,bottom:d.world.y+170}});
  }
 }
 for(const npc of NPCS)if(!indoors.has(npc.id))for(const p of npcExteriorAnchors(npc)){
  const town=TOWN_BY_ID[npc.townId];reserved.push({bounds:npcStandingReservation(p,town.world.x,town.world.y)});
 }
 for(const d of buildings){const half=Math.max(120,artFrameSize(d.texture??'world_objects',d.frame).width*d.scale*.30);
  reserved.push({bounds:{left:d.world.x-half,right:d.world.x+half,top:d.world.y-12,bottom:d.world.y+240}});}
 const people=new StaticBoundsIndex(reserved),chunkCounts=new Map<string,number>();
 for(const layout of layouts){
  const town=TOWN_BY_ID[layout.townId],origin=town.world;
  const summary:StreetscapeSummary={townId:town.id,added:0,omitted:0};SETTLEMENT_STREETSCAPES.push(summary);
  const limit=town.id==='highmere'?240:town.kind==='capital'||town.kind==='stronghold'?90:54;
  const cold=town.regionId==='nardorous'||town.regionId==='frostlands',dry=town.regionId==='rindass',ash=town.regionId==='darkav';
  const local=(r:Rect):Rect=>({left:r.left-origin.x,right:r.right-origin.x,top:r.top-origin.y,bottom:r.bottom-origin.y});
  const beds=layout.parcels.filter(p=>p.terrain==='farmland'||p.terrain==='water'||/shrine|life-tree|citadel-door|citadel-processional/.test(p.id))
   .map(p=>({left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2}));
  const make=(id:string,kind:string,p:Vec2,texture:WorldPropTexture,frame:number,width:number,solid=true,rotation=0):PropContentDefinition=>({
   id:'detail:'+town.id+':streetlife:'+kind+':beautify:'+id,kind:'prop',world:{x:origin.x+p.x,y:origin.y+p.y},texture,frame,
   scale:width/artFrameSize(texture,frame).width,solid,placement:'fixed',...(rotation?{rotation}:{})});
  const fits=(d:PropContentDefinition)=>{
   const r=boundsOf(d)!,l=local(r),tree=isTreeArt(d.texture!,d.frame),margin=tree?42:20;
   if(![r.left,r.right].every(x=>[r.top,r.bottom].every(y=>insideDefense(town.id,x,y,-90))))return false;
   if(beds.some(b=>overlaps(l,b,16))||layout.streets.some(st=>rectTouchesStreet(l,st,tree?44:28)))return false;
   if(occupied.any(pad(r,margin),o=>overlaps(r,o.bounds,margin))||people.any(pad(r,52),o=>overlaps(r,o.bounds,52)))return false;
   if(fortificationBlocksPoint(d.world.x,d.world.y,tree?64:34))return false;
   const chunk=Math.floor(d.world.x/1536)+':'+Math.floor(d.world.y/1536);
   if((chunkCounts.get(chunk)??0)>=16)return false;
   for(const x of [r.left,(r.left+r.right)/2,r.right])for(const y of [r.top,r.bottom])if(!walkable(x,y))return false;
   return true;
  };
  const admit=(group:PropContentDefinition[])=>{
   if(summary.added+group.length>limit)return false;
   // Admission is atomic for a composition, including opposing dining chairs.
   const additions=new Map<string,number>();
   for(const d of group){const key=Math.floor(d.world.x/1536)+':'+Math.floor(d.world.y/1536);additions.set(key,(additions.get(key)??0)+1);}
   if([...additions].some(([key,count])=>(chunkCounts.get(key)??0)+count>16)||!group.every(fits)){summary.omitted+=group.length;return false;}
   for(const d of group){content.push(d);occupied.add({bounds:boundsOf(d)!});summary.added++;
    const key=Math.floor(d.world.x/1536)+':'+Math.floor(d.world.y/1536);chunkCounts.set(key,(chunkCounts.get(key)??0)+1);}
   return true;
  };
  // Large uses reserve the entire court, including their gate approach and
  // the mill's sail envelope, before any small decorative dressing is fitted.
  const fitsCourt=(r:Rect)=>{
   const l=local(r);
   if(beds.some(b=>overlaps(l,b,36))||layout.streets.some(st=>rectTouchesStreet(l,st,52)))return false;
   if(occupied.any(pad(r,64),o=>overlaps(r,o.bounds,64))||people.any(pad(r,100),o=>overlaps(r,o.bounds,100)))return false;
   let low=Infinity,high=-Infinity;
   const columns=Math.ceil((r.right-r.left)/96),rows=Math.ceil((r.bottom-r.top)/96);
   for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const x=r.left+(r.right-r.left)*col/columns,y=r.top+(r.bottom-r.top)*row/rows;
    if(!insideDefense(town.id,x,y,-110)||!walkable(x,y)||fortificationBlocksPoint(x,y,60))return false;
    const h=heightAt(x,y);if(!Number.isFinite(h))return false;low=Math.min(low,h);high=Math.max(high,h);
    if(high-low>6)return false;
   }
   return true;
  };
  const publicCourts=layout.parcels.filter(p=>/noble|royal|temple|citadel|market|plaza|square|training|barrack|quay|shrine|life-tree|ancient-grove/.test(p.id))
   .map(p=>({left:p.x-p.width/2,right:p.x+p.width/2,top:p.y-p.height/2,bottom:p.y+p.height/2}));
  const accessible=(p:Vec2,bottom:number):Rect|undefined=>{
   const from={x:origin.x+p.x,y:origin.y+bottom+45};let best:Rect|undefined,distance=950;
   for(const street of layout.streets)for(let i=1;i<street.points.length;i++){
    const a=street.points[i-1],b=street.points[i],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    const t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(bottom+45-a.y)*dy)/len)):0;
    const to={x:origin.x+a.x+dx*t,y:origin.y+a.y+dy*t},length=Math.hypot(to.x-from.x,to.y-from.y);
    if(to.y<from.y-12||length>distance)continue;
    const corridor={left:Math.min(from.x,to.x)-48,right:Math.max(from.x,to.x)+48,top:Math.min(from.y,to.y)-30,bottom:Math.max(from.y,to.y)+48};
    if(occupied.any(corridor,o=>overlaps(corridor,o.bounds,12))||people.any(corridor,o=>overlaps(corridor,o.bounds,28)))continue;
    let clear=true;const steps=Math.max(1,Math.ceil(length/48));
    for(let n=0;n<=steps&&clear;n++)for(const side of [-42,0,42]){
     const x=from.x+(to.x-from.x)*n/steps+side,y=from.y+(to.y-from.y)*n/steps;
     if(!walkable(x,y)||fortificationBlocksPoint(x,y,42)){clear=false;break;}
    }
    if(clear){distance=length;best=corridor;}
   }
   return best;
  };
  const candidates:Vec2[]=[];
  for(const p of layout.parcels)if(/rural|stable|beast|common|weavers|garden/.test(p.id)&&!['farmland','water'].includes(p.terrain)){
   for(const side of [-1,0,1])candidates.push({x:p.x+side*p.width*.25,y:p.y});
  }
  for(const lot of layout.buildings)if(!lot.omitted&&/stable|barn|granary|grain/i.test(lot.label)){
   const b=buildings.find(d=>Math.abs(d.world.x-origin.x-lot.x)<1&&Math.abs(d.world.y-origin.y-lot.y)<1);
   if(b){const r=local(boundsOf(b)!);for(const side of [-1,1])candidates.push({x:side<0?r.left-520:r.right+520,y:lot.y+350});}
  }
  // Bounded survey of genuinely unused lower-ward land. Historic buildings,
  // protected squares and scheduled/quest actors have already reserved first.
  const bounds=settlementEnvelope(town);
  for(let y=Math.max(350,bounds.top+400);y<bounds.bottom-380;y+=320)
   for(let x=bounds.left+420;x<bounds.right-380;x+=400)candidates.push({x,y});
  if(!ash){
   let pastures=0,mills=0;
   for(const [candidate,p] of candidates.entries()){
    if(pastures>=(town.id==='highmere'?3:town.kind==='village'?1:2))break;
    const width=720,depth=560,wx=origin.x+p.x,wy=origin.y+p.y;
    const court={left:wx-width/2-36,right:wx+width/2+36,top:wy-depth/2-36,bottom:wy+depth/2+170};
    if(publicCourts.some(r=>overlaps(local(court),r,48))||!fitsCourt(court))continue;
    const approach=accessible(p,p.y+depth/2);if(!approach)continue;
    const id='pasture:'+candidate,rail=(tag:string,x:number,y:number,length:number,rotation=0)=>{
     const w=length/.96;
     return make(id+':'+tag,'pasture-fence',{x:x-Math.sin(rotation)*w*.03,y:y+Math.cos(rotation)*w*.03},'world_assets',3,w,true,rotation);
    };
    const gap=190,wing=(width-gap)/2,top=p.y-depth/2,bottom=p.y+depth/2;
    const group=[rail('north',p.x,top,width),
     rail('west',p.x-width/2,p.y,depth,Math.PI/2),
     rail('east',p.x+width/2,p.y,depth,Math.PI/2),
     rail('south-west',p.x-(gap+wing)/2,bottom,wing),
     rail('south-east',p.x+(gap+wing)/2,bottom,wing),
     make(id+':hay-west','hay-bales',{x:p.x-245,y:p.y-130},'native_civic_bare',9,104),
     make(id+':hay-east','hay-bales',{x:p.x+235,y:p.y+170},'native_civic_bare',9,104),
     make(id+':straw-west','pasture-straw',{x:p.x-195,y:p.y+135},'native_civic_bare',9,110,false),
     make(id+':straw-east','pasture-straw',{x:p.x+100,y:p.y-115},'native_civic_bare',9,95,false),
     make(id+':water','pasture-trough',{x:p.x+235,y:p.y-130},'native_civic_bare',8,72)];
    if(!admit(group))continue;
    occupied.add({bounds:court});people.add({bounds:approach});pastures++;
    registerSettlementPasture({id:'pasture:'+town.id+':'+candidate,townId:town.id,x:wx,y:wy,width,height:depth,
     terrain:dry||cold?'dirt':'grass'});
   }
   // A clear sail sweep belongs to the mill, even though only its tower has a
   // physical body. Never put a mill into a courtyard that could not fit it.
   if(!cold)for(const [candidate,p] of candidates.entries()){
    if(mills>=(town.id==='highmere'?2:1))break;
    const wx=origin.x+p.x,wy=origin.y+p.y;
    const court={left:wx-355,right:wx+355,top:wy-395,bottom:wy+185};
    if(publicCourts.some(r=>overlaps(local(court),r,48))||!fitsCourt(court))continue;
    if(admit([make('mill:'+candidate,'windmill',p,'native_civic_bare',9,320)])){
     occupied.add({bounds:court});mills++;
    }
   }
  }
  const greenery=(id:string,p:Vec2,formal=false)=>{
   if(cold)return admit([make(id,'winter-stone',p,'climate_props',3,68)]);
   if(dry)return admit([make(id,'sage-border',p,'desert_props',2,66,false)]);
   if(ash)return admit([make(id,'basalt-border',p,'climate_props',8,66)]);
   return admit([make(id,formal?'flower-pot':'flowers',p,'woodland_props',1,formal?52:78,formal)]);
  };
  // Dress the side courts according to what each establishment actually does.
  for(const [i,building] of buildings.filter(d=>d.id.startsWith('town:'+town.id+':')).entries()){
   if(summary.added>=limit)break;
   const b=boundsOf(building)!,r=local(b),x=building.world.x-origin.x,y=building.world.y-origin.y;
   const role=(building.label??'').toLowerCase(),side=i%2?-1:1;
   const front={x:side<0?r.left-100:r.right+100,y:y+140};
   const formal=/noble|villa|manor|temple|chapel|archive|royal|council/.test(role);
   if(/stable|barn|granary|fodder/.test(role)){
    admit([make('lot:'+building.id,'hay-bales',front,'native_civic_bare',9,110)]);
    admit([make('lot:'+building.id+':cart','wagon',{x:front.x,y:front.y+195},'native_story_bare',4,132)]);
   }else if(/inn|tavern|bakery|restaurant/.test(role)){
    const group=outdoorDiningLayout(front.x,front.y).map((f,j)=>make('lot:'+building.id+':dining:'+j,f.art==='table'?'cafe-table':'cafe-chair',f,'native_civic_bare',f.art==='table'?9:7,f.width,true,f.rotation));
    admit(group);
    admit([make('lot:'+building.id,'barrels',{x:x-side*(Math.abs(r.right-x)+90),y:y+95},'native_civic_bare',8,62)]);
   }else if(!formal&&!/guard|watch|barrack|smith|guild|citadel|castle/.test(role)){
    if(i%3===0)admit([make('lot:'+building.id,'laundry-line',front,'native_civic_bare',12,230)]);
    else if(i%3===1)admit([make('lot:'+building.id,'barrels',front,'native_civic_bare',8,62)]);
    else admit([make('lot:'+building.id,'household-crates',front,'native_civic_bare',9,72)]);
   }
   greenery('lot:'+building.id+':garden',{x:r.left-100,y:y+65},formal);
   greenery('lot:'+building.id+':garden-right',{x:r.right+100,y:y+65},formal);
   if(formal)admit([make('lot:'+building.id,'bench',{x:front.x,y:front.y+140},'native_civic_bare',7,108)]);
  }
  // A measured rhythm along long streets: paired verges, with junctions left
  // open. Tree crowns reserve their entire silhouette before a trunk is added.
  let sequence=0;
  for(const street of layout.streets){
   if(summary.added>=limit)break;
   for(let part=1;part<street.points.length&&sequence<180;part++){
    const a=street.points[part-1],b=street.points[part],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<420)continue;
    const nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length,spacing=town.id==='highmere'?480:400;
    for(let along=200;along<length-190&&sequence<180;along+=spacing){
     const t=along/length,cx=a.x+(b.x-a.x)*t,cy=a.y+(b.y-a.y)*t,id=sequence++;
     for(const side of [-1,1]){
      const offset=street.width/2+170,p={x:cx+nx*offset*side,y:cy+ny*offset*side};
      if(id%4===0&&!dry&&!ash){
       const texture=cold?'climate_props':'woodland_props',frame=cold?0:5;
       admit([make('verge:'+id+':'+side,'tree',p,texture,frame,cold?132:128)]);
      }else if(id%4===1)admit([make('verge:'+id+':'+side,'bench',p,'native_civic_bare',7,108,true,Math.atan2(ny,nx)+(side<0?Math.PI:0))]);
      else greenery('verge:'+id+':'+side,p,street.surface==='stone'&&!dry&&!ash&&!cold);
     }
    }
   }
  }
  // Soft borders on public greens and orchard edges; open central courts and
  // their entrance approaches remain available for gatherings and quests.
  for(const parcel of layout.parcels){
   if(summary.added>=limit)break;
   if(!/garden|green|orchard|square|common/.test(parcel.id)||parcel.terrain==='farmland'||parcel.terrain==='water')continue;
   for(const side of [-1,1])for(let n=0;n<3;n++){
    const p={x:parcel.x+side*(parcel.width/2-100),y:parcel.y-parcel.height*.25+n*parcel.height*.25};
    greenery('green:'+parcel.id+':'+side+':'+n,p,parcel.terrain==='stone');
    if(n===1)admit([make('green:'+parcel.id+':'+side,'garden-fence',{x:p.x,y:p.y+130},cold?'climate_props':'world_assets',cold?4:3,130)]);
   }
  }
 }
}
