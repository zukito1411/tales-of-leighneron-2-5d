import type {ContentDefinition,Vec2,WorldPropTexture} from '../game/types';
import type {SettlementLayout,Street} from './settlements';
import {TOWN_BY_ID} from './towns';
import {NPCS} from './npcs';
import {NPC_POSITIONS} from './npcPositions';
import {INTERIOR_ASSIGNMENTS} from './interiorAssignments';
import {artFrameSize} from './art';
import {spriteBounds,propPlacementBounds,overlaps,rectTouchesStreet,segmentTouchesRect,type Rect} from './settlementGeometry';
import {insideDefense} from './settlementDefenses';
import {fortificationBlocksPath} from './fortifications';
import {settlementGroundPlan} from './settlementPlanning';
import {worldSpriteProfile} from './worldSpriteGeometry';
import {StaticBoundsIndex} from '../game/systems/StaticBoundsIndex';

export interface SettlementCommon {
  id:string;kind:'market'|'gathering'|'training'|'workyard';name:string;
  world:Vec2;approach:Vec2;bounds:Rect;noticeId:string;
}
interface Obstacle {bounds:Rect;body?:Rect;person?:boolean}
interface Furnishing {id:string;x:number;y:number;texture:WorldPropTexture;frame:number;height:number;notice?:boolean}
const pad=(r:Rect,n:number):Rect=>({left:r.left-n,right:r.right+n,top:r.top-n,bottom:r.bottom+n});
const move=(r:Rect,p:Vec2):Rect=>({left:r.left+p.x,right:r.right+p.x,top:r.top+p.y,bottom:r.bottom+p.y});

/** Furnish remaining space only after every existing structure, story object
 * and notice board has its final placement. No old content is displaced. */
export function addSettlementCommons(layouts:SettlementLayout[],content:ContentDefinition[],walkable:(x:number,y:number)=>boolean){
  const indoor=new Set(INTERIOR_ASSIGNMENTS.map(([id])=>id));
  const obstacles:Obstacle[]=[];
  for(const d of content){
    if(d.kind==='npc'||d.kind==='creature'){
      if(d.kind==='npc'&&indoor.has(d.npcId))continue;
      obstacles.push({person:true,bounds:{left:d.world.x-38,right:d.world.x+38,top:d.world.y-100,bottom:d.world.y+36}});continue;
    }
    if(!('frame' in d))continue;
    const texture=d.texture??'world_objects',scale=d.scale??.6,profile=worldSpriteProfile(texture,d.frame);
    if(profile?.floor)continue;
    const painted=spriteBounds(texture,d.frame,scale,d.world.x,d.world.y,d.anchor==='center');
    const body=('solid' in d&&d.solid)||profile?.forceSolid?propPlacementBounds(texture,d.frame,scale,d.world.x,d.world.y,d.anchor==='center',
      'wallSegment' in d?d.wallSegment:undefined):undefined;
    const bounds=body?{left:Math.min(painted.left,body.left),right:Math.max(painted.right,body.right),
      top:Math.min(painted.top,body.top),bottom:Math.max(painted.bottom,body.bottom)}:painted;
    obstacles.push({bounds,body});
  }
  // Protect future schedules, escort arrivals and rescued contacts too.
  for(const npc of NPCS){
    if(indoor.has(npc.id))continue;
    const town=TOWN_BY_ID[npc.townId],slots=NPC_POSITIONS[npc.id];
    const points=slots?[slots.position,slots.home,...slots.schedule,slots.arrival,npc.storyReturn?.position]
      :[npc.worldOffset,npc.homeLocation,...npc.schedule.map(s=>s.location),npc.storyReturn?.position];
    for(const p of points)if(p)obstacles.push({person:true,bounds:{left:town.world.x+p.x-38,right:town.world.x+p.x+38,
      top:town.world.y+p.y-100,bottom:town.world.y+p.y+36}});
  }
  for(const layout of layouts){
    const town=TOWN_BY_ID[layout.townId];
    for(const p of layout.parcels)if(p.terrain==='farmland'||p.terrain==='water'||/life-tree|shrine|citadel-door|citadel-processional/.test(p.id))
      obstacles.push({bounds:{left:town.world.x+p.x-p.width/2,right:town.world.x+p.x+p.width/2,
        top:town.world.y+p.y-p.height/2,bottom:town.world.y+p.y+p.height/2}});
  }
  const index=new StaticBoundsIndex(obstacles),added:Obstacle[]=[],courts:Rect[]=[];
  const blocked=(r:Rect,includePeople=true)=>index.any(pad(r,20),o=>(includePeople||!o.person)&&overlaps(r,o.bounds,20))
    ||added.some(o=>overlaps(r,o.bounds,20));
  const pathClear=(a:Vec2,b:Vec2,width:number)=>{
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length>960||fortificationBlocksPath(a,b,width/2+8))return false;
    const bounds={left:Math.min(a.x,b.x)-width/2,right:Math.max(a.x,b.x)+width/2,
      top:Math.min(a.y,b.y)-width/2,bottom:Math.max(a.y,b.y)+width/2};
    const touches=(o:Obstacle)=>Boolean(o.body&&segmentTouchesRect(a,b,pad(o.body,width/2+8)));
    if(index.any(bounds,touches)||added.some(touches))return false;
    const steps=Math.max(1,Math.ceil(length/8)),nx=length?-(b.y-a.y)/length*width/2:0,ny=length?(b.x-a.x)/length*width/2:0;
    for(let i=0;i<=steps;i++){
      const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
      if(!walkable(x,y)||!walkable(x+nx,y+ny)||!walkable(x-nx,y-ny))return false;
    }
    return true;
  };
  const project=(p:Vec2,a:Vec2,b:Vec2)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;
    return {x:a.x+dx*t,y:a.y+dy*t};
  };
  for(const layout of layouts){
    const town=TOWN_BY_ID[layout.townId],cold=town.regionId==='frostlands'||town.regionId==='nardorous';
    const grove=town.regionId==='narenthil',military=town.kind==='capital'||town.kind==='stronghold';
    const greens=layout.parcels.filter(p=>p.id.endsWith(':market-green'));
    const work=layout.parcels.find(p=>/caravan-yard|stable-yard|boatwright-yard|shipyard|hunter-yard|forge-ward|beast-yard/.test(p.id));
    const plans:Array<{kind:SettlementCommon['kind'];name:string;preferred:Vec2;description:string}>=[
      {kind:'market',name:town.name+(grove?' Herb Exchange':cold?' Provision Market':' Common Market'),preferred:greens[0]??{x:-800,y:250},
        description:grove?'Growers exchange dried herbs and seedlings here. The open middle is kept for buyers and handcarts.':'Households bring provisions here, with stalls facing a shared walking aisle and freight kept at the edges.'},
      {kind:'gathering',name:town.name+' Gathering Green',preferred:greens[1]??{x:800,y:250},
        description:'Neighbors meet beside the shared water and resting benches. The crossing paths remain open to everyone.'},
      {kind:military?'training':'workyard',name:town.name+(military?' Practice Court':town.kind==='harbor'?' Quay Work Court':' Caravan Work Court'),preferred:work??{x:0,y:850},
        description:military?'Practice targets face an open exercise strip. Watch supplies stand to the side, clear of the public approach.':'A shared yard for sorting deliveries and repairing travel gear. Supplies line the edges, leaving turning room in the middle.'},
    ];
    layout.commons=[];
    for(const plan of plans){
      const id='commons:'+town.id+':'+plan.kind,noticeId=id+':notice';
      const furnishings:Furnishing[]=plan.kind==='market'?[
        {id:'stall-left',x:-155,y:-100,texture:'native_civic_bare',frame:5,height:100},
        {id:'stall-right',x:155,y:-100,texture:'native_civic_bare',frame:5,height:100},
        {id:'stock',x:-195,y:235,texture:'native_civic_bare',frame:9,height:48},
        {id:'seat',x:190,y:235,texture:'native_civic_bare',frame:7,height:38},
      ]:plan.kind==='gathering'?[
        {id:'well',x:0,y:-140,texture:'native_civic_bare',frame:6,height:78},
        {id:'seat-left',x:-165,y:-10,texture:'native_civic_bare',frame:7,height:38},
        {id:'seat-right',x:165,y:-10,texture:'native_civic_bare',frame:7,height:38},
      ]:plan.kind==='training'?[
        {id:'target-left',x:-150,y:-100,texture:'native_story_bare',frame:5,height:82},
        {id:'target-right',x:150,y:-100,texture:'native_story_bare',frame:5,height:82},
        {id:'stores',x:195,y:235,texture:'native_civic_bare',frame:9,height:48},
      ]:[
        {id:'work-cart',x:-165,y:-100,texture:'native_story_bare',frame:4,height:92},
        {id:'stores',x:165,y:-100,texture:'native_civic_bare',frame:9,height:54},
        {id:'rest-seat',x:190,y:235,texture:'native_civic_bare',frame:7,height:38},
      ];
      furnishings.push({id:'notice',x:-105,y:245,texture:'native_civic_bare',frame:11,height:58,notice:true});
      const templates=furnishings.map(f=>{const scale=f.height/artFrameSize(f.texture,f.frame).height;
        return {f,scale,bounds:spriteBounds(f.texture,f.frame,scale,f.x,f.y)};});
      const local:Rect={left:-270,right:270,top:-240,bottom:350};
      const preferred={x:town.world.x+plan.preferred.x,y:town.world.y+plan.preferred.y};
      function* candidates(){
        yield preferred;
        for(const radius of [128,256,384,512,768,1024,1280,1536])for(let i=0;i<24;i++){
          const a=i*Math.PI/12;yield {x:Math.round(preferred.x+Math.cos(a)*radius),y:Math.round(preferred.y+Math.sin(a)*radius)};
        }
        // Expanded wards/keep precincts can have useful courts beyond the old
        // market anchor. A coarse bounded pass covers their actual enclosure.
        for(const r of settlementGroundPlan(town).rectangles)
          for(let y=r.top+384;y<=r.bottom-448;y+=384)
            for(let x=r.left+384;x<=r.right-384;x+=384)yield {x:town.world.x+x,y:town.world.y+y};
      }
      for(const center of candidates()){
        const bounds=move(local,center),entry={x:center.x,y:center.y+310};
        if(![bounds.left,bounds.right].every(x=>[bounds.top,bounds.bottom].every(y=>insideDefense(town.id,x,y,-96)))
          ||blocked(bounds,false)||courts.some(r=>overlaps(bounds,r,48)))continue;
        const rects=templates.map(t=>move(t.bounds,center));
        if(rects.some(r=>blocked(r)||layout.streets.some(s=>rectTouchesStreet({left:r.left-town.world.x,right:r.right-town.world.x,
          top:r.top-town.world.y,bottom:r.bottom-town.world.y},s,16))))continue;
        if(![center,entry,{x:bounds.left,y:center.y+110},{x:bounds.right,y:center.y+110}].every(p=>walkable(p.x,p.y)))continue;
        const links=layout.streets.flatMap(s=>s.points.slice(1).map((b,i)=>{
          const p=project({x:entry.x-town.world.x,y:entry.y-town.world.y},s.points[i],b);return {x:town.world.x+p.x,y:town.world.y+p.y};
        })).sort((a,b)=>(a.x-entry.x)**2+(a.y-entry.y)**2-(b.x-entry.x)**2-(b.y-entry.y)**2);
        const approach=links.slice(0,12).find(p=>pathClear(entry,p,64)
          &&!rects.some(r=>segmentTouchesRect(entry,p,pad(r,44))));
        if(!approach)continue;
        const lanes:Street[]=[
          {id:id+':approach',width:64,surface:military?'stone':'dirt',points:[approach,entry].map(p=>({x:p.x-town.world.x,y:p.y-town.world.y}))},
          {id:id+':aisle',width:72,surface:'dirt',points:[{x:center.x-town.world.x,y:center.y-town.world.y+310},{x:center.x-town.world.x,y:center.y-town.world.y+50}]},
          {id:id+':crossing',width:64,surface:'dirt',points:[{x:center.x-town.world.x-250,y:center.y-town.world.y+110},{x:center.x-town.world.x+250,y:center.y-town.world.y+110}]},
          {id:id+':notice-access',width:48,surface:'dirt',points:[{x:center.x-town.world.x,y:center.y-town.world.y+310},{x:center.x-town.world.x-105,y:center.y-town.world.y+310}]},
        ];
        if(rects.some(r=>lanes.some(s=>rectTouchesStreet({left:r.left-town.world.x,right:r.right-town.world.x,top:r.top-town.world.y,bottom:r.bottom-town.world.y},s,8))))continue;
        if(lanes.some(s=>!pathClear({x:town.world.x+s.points[0].x,y:town.world.y+s.points[0].y},
          {x:town.world.x+s.points[1].x,y:town.world.y+s.points[1].y},s.width)))continue;
        for(const [i,{f,scale}] of templates.entries()){
          const world={x:center.x+f.x,y:center.y+f.y};
          content.push(f.notice?{id:noticeId,kind:'interactable',world,texture:f.texture,frame:f.frame,scale,solid:true,
            name:plan.name,description:plan.description,repeatText:plan.description,repeatable:true}
            :{id:id+':'+f.id,kind:'prop',world,texture:f.texture,frame:f.frame,scale,solid:true,label:plan.name});
          added.push({bounds:rects[i],body:propPlacementBounds(f.texture,f.frame,scale,world.x,world.y)});
        }
        layout.commons.push({id,kind:plan.kind,name:plan.name,world:center,approach,bounds,noticeId});courts.push(bounds);
        layout.streets.push(...lanes);
        layout.parcels.push({id,purpose:plan.description,terrain:military?'stone':cold?'snow':'dirt',
          x:center.x-town.world.x,y:center.y-town.world.y+55,width:540,height:590});
        break;
      }
    }
  }
}
