import type {Vec2} from '../game/types';
import {WORLD_CONTENT} from './content';
import {TOWNS,TOWN_BY_ID} from './towns';
import {spriteBounds} from './settlementGeometry';
import type {ArtTextureKey} from './art';
import {NPC_BY_ID,NPC_NAME_ALIASES} from './npcs';
import {rewriteNpcMentions} from './npcPresentation';
import {CASTLE_GUARD_POSTS} from './castleResidents';
import type {InteriorArtKey} from './interiorArt';
import {TOWER_ROOM_SIZE,TOWER_ROUND_FLOOR,TOWER_SOUTH_ENTRY} from './towerRoom';

export type InteriorProfile='home'|'villa'|'inn'|'castle'|'archive'|'store'|'workshop'|'barracks'|'kitchen'|'market'|'civic'|'chapel'|'cave';
export function interiorProfile(name:string,hall=false):InteriorProfile {
  if(/Crown Hall|Whitebough Hall|Citadel Hall|Obsidian Citadel|Clan Assembly Hall|Great River Hall|Clan Longhouse|castle/i.test(name))return 'castle';
  if(/inn|tavern/i.test(name))return 'inn';
  if(/barrack|guard post/i.test(name))return 'barracks';
  if(/archive|lore|charter|counting|customs/i.test(name))return 'archive';
  if(/store|granary|warehouse/i.test(name))return 'store';
  if(/forge|smith|craft|workshop|sailmaker|boatwright|bowyer|weaver|fletcher|rope guild/i.test(name))return 'workshop';
  if(/kitchen/i.test(name))return 'kitchen';
  if(/market|traders/i.test(name))return 'market';
  if(/chapel|temple/i.test(name))return 'chapel';
  if(/harbor guild|mine guild|bridgekeeper hall|trade hall/i.test(name))return 'civic';
  if(/villa|manor|noble|estate|council house|^Grove House$/i.test(name))return 'villa';
  return hall?'civic':'home';
}
export interface InteriorEntry {id:string;townId:string;name:string;kit:string;door:Vec2;hall:boolean;profile:InteriorProfile}
const kits:Record<string,string>={trandum:'trandum_rustic',narenthil:'narenthil_elven',nardorous:'nardorous_alpine',
  rindass:'rindass_orcan',druganwoods:'druganwoods_dwarven',portquill:'portquill_maritime',frostlands:'frostlands_longhouse',darkav:'darkav_obsidian'};
/** Stable links to existing exterior buildings, never menu-selected stages. */
export const INTERIOR_ENTRIES:InteriorEntry[]=TOWNS.flatMap(town=>{
  const buildings=WORLD_CONTENT.filter(d=>d.kind==='settlement-prop'&&d.id.startsWith(`town:${town.id}:building:`)
    &&d.label&&!/\b(tower|stable|gate|gatehouse|shrine|ruin)s?\b/i.test(d.label)
    &&(!/\bwatch\b/i.test(d.label)||/\bbarracks?\b/i.test(d.label)));
  return buildings.flatMap(d=>{
    if(d.kind!=='settlement-prop'||!d.texture||!d.label)return [];
    const b=spriteBounds(d.texture as ArtTextureKey,d.frame,d.scale,d.world.x,d.world.y);
    const hall=/hall|castle|archive|citadel|court|crown/i.test(d.label);
    const profile=interiorProfile(d.label,hall);
    const noble=town.id==='highmere'&&(profile==='castle'||profile==='villa'||/Royal Archive/.test(d.label));
    return [{id:d.id,townId:town.id,name:d.label,kit:noble?'highmere_noble':kits[town.regionId],
      door:{x:d.world.x,y:b.bottom+38},hall,profile}];
  });
});
/** Explicit story/workplace residency. Trainers, patrols, field workers and
 * the Tovin escort remain outdoors. IDs and saved trust are never replaced. */
const assignments:Array<[string,string]>=[
  ['sena-marrow','Marrow Inn'],['joren-pike','Pike Smithy'],['torren-ashfield','West Cottages'],
  ['renna-vale','Royal Archive'],['lady-adria-vale','Crown Hall'],['barric-thorne','West Barracks'],
  ['maela-quill','Market Hall'],['osric-flint','Guild Forge'],['tamsin-reed','Westgate Inn'],
  ['davin-bridge','River Customs'],['sevrin-hale','Counting House'],['mairin-reed','Morrow Kitchen'],
  ['nella-harrow','Weavers Row'],['iven-harrow','Relief Warehouse'],['bela-reed','Caravan Inn'],
  ['elarion-king','Whitebough Hall'],['elarion-lorekeeper','Lore Archive'],['elarion-bowyer','Bowyer Hall'],
  ['moonfall-herbalist','Herbalist Cottage'],['dael-vale','Grove House'],
  ['starhold-quartermaster','Quartermaster Stores'],['redmesa-forgewright','Clan Forge'],
  ['deepford-runesmith','Hall Archive'],['deepford-boatwright','Boatwright Hall'],
  ['tidewatch-harbor-master','Harbor Guild'],['tidewatch-sailmaker','Sailmaker House'],
  ['skallheim-trader','Fish Traders Hall'],['blackspire-forgemaster','Forge Hall'],
  ['elarion-hall-guard-west','Whitebough Hall'],['elarion-hall-guard-east','Whitebough Hall'],
  ...CASTLE_GUARD_POSTS.map(post=>[post.npcId,post.building] as [string,string]),
];
export interface InteriorResident {npcId:string;entry:InteriorEntry;slot:number;guardSide?:'west'|'east'}
export const INTERIOR_RESIDENTS:InteriorResident[]=[];
for(const [npcId,building] of assignments){
  const npc=NPC_BY_ID[npcId],localizedBuilding=rewriteNpcMentions(building,NPC_NAME_ALIASES);
  const entry=npc&&INTERIOR_ENTRIES.find(e=>e.townId===npc.townId&&(e.name===building||e.name===localizedBuilding));
  if(!entry)continue; // A retired/omitted building never strands a story actor.
  const slot=INTERIOR_RESIDENTS.filter(r=>r.entry.id===entry.id).length;
  const guardSide=CASTLE_GUARD_POSTS.find(post=>post.npcId===npcId)?.side
    ??(npcId==='elarion-hall-guard-west'?'west':npcId==='elarion-hall-guard-east'?'east':undefined);
  INTERIOR_RESIDENTS.push({npcId,entry,slot,guardSide});
}
export const NPC_INTERIOR_BY_ID=Object.fromEntries(INTERIOR_RESIDENTS.map(r=>[r.npcId,r])) as Record<string,InteriorResident>;
export const INTERIOR_RESIDENTS_BY_ENTRY=Object.fromEntries(INTERIOR_ENTRIES.map(e=>[e.id,
  INTERIOR_RESIDENTS.filter(r=>r.entry.id===e.id)])) as Record<string,InteriorResident[]>;
export const interiorTown=(entry:InteriorEntry)=>TOWN_BY_ID[entry.townId];
export interface RoomRect {x:number;y:number;width:number;height:number}
export type RoomKind='living'|'bedroom'|'kitchen'|'storage'|'tavern'|'throne'|'council'|'library'|'gallery'|'barracks'|'dining'|'workshop'|'archive'|'office'|'market'|'chapel';
export interface InteriorRoom extends RoomRect {id:string;label:string;kind:RoomKind;material:0|1}
export interface RoomFloor extends RoomRect {material:0|1;kind?:RoomKind}
export interface RoomObject {art:InteriorArtKey;x:number;y:number;width:number;solid?:RoomRect}
export interface RoomPlan {
  floors:RoomFloor[];rooms:InteriorRoom[];objects:RoomObject[];entrance:Vec2;residents:Vec2[];
  roundFloor?:Vec2&{radius:number};
  /** Clear opening and lintel height, shared by mesh, collision and interaction. */
  entranceWidth?:number;entranceHeight?:number;
  throneResident?:Vec2;guardPosts?:{west:Vec2;east:Vec2};
}
export function roomFloorContains(plan:RoomPlan,x:number,y:number){
  if(plan.roundFloor){const circle=plan.roundFloor;return (x-circle.x)**2+(y-circle.y)**2<=circle.radius**2;}
  return plan.floors.some(r=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);
}
const floorObject=(art:InteriorArtKey)=>art==='rug';
/** Deliberately separated rooms and broad overlapping hallways. Floors form a
 * connected union; gaps between rooms stay black and are never traversable. */
export function roomPlan(hall:boolean,name='',selectedProfile=interiorProfile(name,hall),kit=''):RoomPlan {
  if(selectedProfile==='cave'&&name==='Tower of Might')return {
    // Bounding rectangle is for camera extents only; movement uses roundFloor.
    floors:[{x:0,y:0,width:TOWER_ROOM_SIZE,height:TOWER_ROOM_SIZE,material:0}],
    rooms:[{id:'might-arena',label:'Tower of Might',kind:'throne',x:190,y:190,width:1420,height:1420,material:0}],
    roundFloor:TOWER_ROUND_FLOOR,objects:[],entrance:TOWER_SOUTH_ENTRY,residents:[],
  };
  if(selectedProfile==='cave')return {
    floors:[{x:120,y:120,width:960,height:900,material:0},{x:360,y:1000,width:480,height:400,material:0},
      {x:0,y:400,width:200,height:360,material:0},{x:1000,y:350,width:200,height:350,material:0}],
    rooms:[{id:'cavern',label:name,kind:'storage',x:120,y:120,width:960,height:900,material:0}],
    objects:[],entrance:{x:600,y:1280},residents:[],
  };
  const rooms:InteriorRoom[]=[],floors:RoomFloor[]=[],objects:RoomObject[]=[];
  const room=(id:string,label:string,kind:RoomKind,x:number,y:number,width:number,height:number,material:0|1=0)=>{
    const r={id,label,kind,x,y,width,height,material};rooms.push(r);floors.push(r);return r;
  };
  const passage=(x:number,y:number,width:number,height:number)=>floors.push({x,y,width,height,material:0});
  let main:InteriorRoom,entrance:Vec2,throneResident:Vec2|undefined,guardPosts:RoomPlan['guardPosts'];
  let entranceWidth:number|undefined,entranceHeight:number|undefined;
  if(selectedProfile==='castle'){
    main=room('audience','Audience & throne hall','throne',660,0,1000,980);
    room('council','Council chamber','council',0,0,500,430);
    room('library','Household library','library',0,560,500,430);
    room('royal-chamber','Private chamber','bedroom',1840,0,540,430,1);
    room('kitchen','Household kitchen','kitchen',1840,560,540,430,1);
    const gallery=room('gallery','Entrance gallery','gallery',660,950,1000,400);
    room('barracks','Household guardroom','barracks',0,1150,500,460,1);
    room('dining','Household dining room','dining',1840,1150,540,460,1);
    // Continuous side galleries connect both upper and lower chambers.
    // Overlap their room thresholds generously; do not make a 150px slit
    // serve a grand hall, guardroom and dining wing.
    passage(420,140,320,1320);passage(1560,140,360,1320);
    passage(950,1300,420,230);entrance={x:1160,y:1450};
    entranceWidth=280;entranceHeight=190;
    throneResident={x:1160,y:350};
    guardPosts={west:{x:gallery.x+210,y:gallery.y+185},east:{x:gallery.x+790,y:gallery.y+185}};
  }else if(selectedProfile==='inn'||selectedProfile==='villa'){
    main=room('common',selectedProfile==='inn'?'Common room & reception':'Living & reception room',
      selectedProfile==='inn'?'tavern':'living',0,560,1100,620);
    room('kitchen','Kitchen', 'kitchen',0,0,420,400,1);
    room('guest-west',selectedProfile==='inn'?'West guest chamber':'Family bedroom','bedroom',500,0,260,400,1);
    room('guest-east',selectedProfile==='inn'?'East guest chamber':'Private study',
      selectedProfile==='inn'?'bedroom':'office',840,0,260,400,1);
    passage(130,380,840,200);passage(460,1160,180,160);entrance={x:550,y:1250};
  }else {
    const kind:RoomKind=selectedProfile==='workshop'?'workshop':selectedProfile==='archive'?'archive'
      :selectedProfile==='store'?'storage':selectedProfile==='barracks'?'barracks'
      :selectedProfile==='kitchen'?'kitchen':selectedProfile==='market'?'market'
      :selectedProfile==='chapel'?'chapel':selectedProfile==='civic'?'council':'living';
    main=room('main',name||'Living room',kind,0,420,840,580);
    room('west',selectedProfile==='home'?'Family bedroom':selectedProfile==='barracks'?'Sleeping quarters':'Stores',
      selectedProfile==='home'||selectedProfile==='barracks'?'bedroom':'storage',0,0,420,320,1);
    room('east',selectedProfile==='home'?'Kitchen':selectedProfile==='archive'?'Private study':'Household chamber',
      selectedProfile==='home'?'kitchen':selectedProfile==='archive'?'office':'bedroom',520,0,320,320,1);
    passage(130,300,580,140);passage(330,980,180,160);entrance={x:420,y:1070};
  }
  const contactHeight:Partial<Record<InteriorArtKey,number>>={bed:1.1,table:.5,chair:.5,bench:.32,
    hearth:.3,counter:.32,wardrobe:.34,bookcase:.3,pantry:.34,workstation:.3,signature:.35,barrel:.5,chest:.45,planter:.35};
  const place=(r:InteriorRoom,art:InteriorArtKey,x:number,y:number,width:number)=>{
    const wx=r.x+x,wy=r.y+y,h=width*(contactHeight[art]??.3);
    objects.push({art,x:wx,y:wy,width,...(!floorObject(art)?{solid:{x:wx-width*.43,y:wy-h,width:width*.86,height:h}}:{})});
  };
  for(const r of rooms){
    const w=r.width,h=r.height;
    if(r.kind==='bedroom'||r.kind==='barracks'){
      place(r,'bed',w<360?80:100,220,w<360?100:115);
      place(r,'wardrobe',w<360?w-65:w-95,195,w<360?80:100);
      place(r,'chest',w<360?w-65:w-95,h-65,w<360?75:90);
      if(r.kind==='barracks'&&w>=420)place(r,'bed',245,220,115);
      else if(w>=420)place(r,'rug',w/2,h-75,170);
    }else if(r.kind==='kitchen'){
      place(r,'hearth',w<360?80:105,w<360?140:190,w<360?105:140);
      place(r,'pantry',w<360?w-70:w-95,w<360?140:190,w<360?95:125);
      place(r,'workstation',w-120,h-65,165);place(r,'barrel',80,h-60,65);
    }else if(r.kind==='storage'){
      place(r,'pantry',115,175,155);place(r,'chest',w-105,175,115);
      place(r,'barrel',90,h-65,70);place(r,'barrel',w-95,h-65,70);
    }else if(r.kind==='library'||r.kind==='archive'||r.kind==='office'){
      place(r,'bookcase',115,180,155);
      if(w>400)place(r,'bookcase',w-115,180,155);
      place(r,'workstation',w-130,h-70,175);
    }else if(r.kind==='throne'){
      const royalSeat=['highmere_noble','rindass_orcan','frostlands_longhouse'].includes(kit)||!kit;
      place(r,royalSeat?'signature':'chair',w/2,255,royalSeat?190:140);
      if(!royalSeat)place(r,'signature',150,470,140);
      place(r,'rug',w/2,635,340);
      place(r,'planter',150,220,85);place(r,'planter',w-150,220,85);
      place(r,'bench',160,740,155);place(r,'bench',w-160,740,155);
    }else if(r.kind==='gallery'){
      place(r,'rug',w/2,310,260);
      place(r,'planter',95,190,80);place(r,'planter',w-95,190,80);
    }else if(r.kind==='workshop'){
      place(r,'hearth',150,230,195);place(r,'workstation',w-200,235,230);
      place(r,'chest',160,h-90,135);place(r,'pantry',w-135,h-90,150);
    }else if(r.kind==='chapel'){
      place(r,'signature',w/2,210,165);place(r,'rug',w/2,420,240);
      place(r,'bench',160,350,180);place(r,'bench',w-160,350,180);
    }else if(r.kind==='council'||r.kind==='dining'){
      place(r,'table',w/2,250,210);place(r,'chair',85,280,65);
      place(r,'chair',w-85,280,65);place(r,'bookcase',w-100,h-65,120);
    }else {
      place(r,'counter',180,255,230);
      place(r,'table',w-265,265,205);
      place(r,'hearth',w-115,175,140);
      if(w>900)place(r,'table',w-220,h-95,200);
      else place(r,'bench',w-175,h-85,155);
      place(r,'rug',w/2,h-135,200);
      if(r.kind==='market')place(r,'pantry',125,h-75,150);
    }
  }
  return {floors,rooms,objects,entrance,entranceWidth,entranceHeight,throneResident,guardPosts,
    residents:[{x:main.x+180,y:main.y+350},{x:main.x+main.width-260,y:main.y+370},
      {x:main.x+main.width/2-140,y:main.y+470}]};
}
