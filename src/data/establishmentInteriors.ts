import type {InteriorArtKey} from './interiorArt';
import {stableFurnishingSpec} from './stableFurnishings';
import {STABLE_ENTRANCE} from './stableEntrance';
import {diningFurniture,interiorFurnitureFootprint,type FurnitureHeading} from './interiorFurnitureLayout';
import {establishmentFurnishingUse} from './interiorEstablishmentIdentity';
import type {RegionId} from '../game/types';
import type {InteriorEntry,InteriorFurnishingUse,InteriorOccupant,InteriorProfile,InteriorRoom,RoomObject,RoomPlan,RoomRect} from './interiors';

const overlaps=(a:RoomRect,b:RoomRect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
// Match the full ground depth of the existing furniture models. Placement
// includes a small edge margin; the public aisle is never a furniture slot.
const depths:Partial<Record<InteriorArtKey,number>>={table:.5,chair:.5,bench:.32,barrel:.86,bed:1.1,
  hearth:.3,counter:.32,wardrobe:.34,bookcase:.3,pantry:.34,workstation:.3,chest:.45,planter:.55};
function person(id:string,role:string,family:InteriorOccupant['family'],x:number,y:number,lines:readonly string[],facing={x:0,y:1}):InteriorOccupant {
  return {id,role,family,x,y,lines,facing};
}

/** Authored, repeatable room arrangements. Widths never stretch the furniture
 * art: the presentation continues to use its normal uniform source scale. */
export function establishmentPlan(profile:InteriorProfile,name:string,identity=establishmentFurnishingUse(profile,name),entryDoor?:Pick<InteriorEntry,'doorWidth'|'doorHeight'>):RoomPlan|undefined {
  const shop=identity&&['clothier','bakery','restaurant','herbalist','bookseller'].includes(identity);
  if(!shop&&!['inn','guild','armory','store','stable'].includes(profile))return;
  const use:InteriorFurnishingUse=identity??(profile==='inn'?'tavern':profile as InteriorFurnishingUse);
  const stableDoorWidth=entryDoor?.doorWidth??STABLE_ENTRANCE.width;
  const stableDoorHeight=entryDoor?.doorHeight??STABLE_ENTRANCE.height;
  const rooms:InteriorRoom[]=[],floors:RoomPlan['floors']=[],objects:RoomObject[]=[],occupants:InteriorOccupant[]=[],aisles:RoomRect[]=[];
  const room=(id:string,label:string,kind:InteriorRoom['kind'],x:number,y:number,width:number,height:number,material:0|1=0)=>{
    const value={id,label,kind,x,y,width,height,material};rooms.push(value);floors.push(value);return value;
  };
  const passage=(x:number,y:number,width:number,height:number)=>{floors.push({x,y,width,height,material:0});};
  const aisle=(x:number,y:number,width:number,height:number)=>aisles.push({x,y,width,height});
  const fittingUse=(r:InteriorRoom)=>r.kind==='bedroom'?undefined:r.kind==='office'?'guild':r.kind==='kitchen'?'kitchen'
    :r.kind==='workshop'&&profile==='guild'?/cloth|weav|sailmaker|dyer/i.test(name)?'clothier':'workshop'
    :profile==='stable'&&r.kind!=='stable'?'store':use;
  const place=(r:InteriorRoom,art:InteriorArtKey,x:number,y:number,width:number,objectUse=fittingUse(r),rotation:FurnitureHeading=0,walkable=false)=>{
    const wx=r.x+x,wy=r.y+y,depth=width*(stableFurnishingSpec(art,objectUse)?.depth??depths[art]??.3);
    const footprint=interiorFurnitureFootprint(wx,wy,width,depth,rotation);
    const solid=art==='rug'||walkable?undefined:footprint;
    // Authored room objects must fit their room and cannot cover a public lane.
    if(art!=='rug'&&(footprint.x<r.x+30||footprint.x+footprint.width>r.x+r.width-30
      ||footprint.y<r.y+30||footprint.y+footprint.height>r.y+r.height-30
      ||aisles.some(a=>overlaps(a,footprint))||solid&&objects.some(o=>o.solid&&overlaps(o.solid,solid))))return;
    objects.push({art,x:wx,y:wy,width,solid,use:objectUse,rotation});
  };
  const dining=(r:InteriorRoom,x:number,y:number,width=210)=>{
    const group=diningFurniture(r.x+x,r.y+y,width);
    // Admit the complete table setting together, including turned chair backs.
    if(group.some(o=>{const s=o.solid!;return s.x<r.x+30||s.x+s.width>r.x+r.width-30
      ||s.y<r.y+30||s.y+s.height>r.y+r.height-30||aisles.some(a=>overlaps(a,s))
      ||objects.some(existing=>existing.solid&&overlaps(existing.solid,s));}))return;
    objects.push(...group.map(object=>({...object,use:fittingUse(r)})));
  };
  let entrance={x:540,y:1320};
  let residents:RoomPlan['residents'],visitorPositions:RoomPlan['visitorPositions'];
  let populationLimit:number|undefined;
  if(shop){
    const food=use==='bakery'||use==='restaurant',cloth=use==='clothier',books=use==='bookseller';
    const main=room('main',cloth?'Clothing displays & fitting floor':use==='bakery'?'Pastry counter & tea tables'
      :use==='restaurant'?'Dining room & service counter':books?'Books & reading room':'Remedies & apothecary counter',
      food?'dining':'market',0,420,1200,840);
    const workroom=room('west',cloth?'Cutting & sewing room':food?'Oven & preparation room':books?'Book repair room':'Remedy preparation',
      food?'kitchen':'workshop',0,0,420,280,1);
    const office=room('east','Stock records & receiving','office',780,0,420,280,1);
    passage(140,260,920,180);passage(480,1240,240,180);entrance={x:600,y:1340};
    aisle(480,420,240,840);aisle(70,870,1060,120);
    // The counter and its stock occupy one service bay; tables and displays
    // occupy the opposite bay. Both are reached from the same broad cross aisle.
    place(main,'pantry',190,170,230);place(main,'counter',260,350,300);
    if(cloth){
      place(main,'wardrobe',880,190,105);place(main,'wardrobe',1060,190,105);
      place(main,'workstation',990,350,240);
      place(main,'pantry',210,720,260);place(main,'workstation',990,720,240);
    }else{
      place(main,books?'bookcase':'pantry',1000,170,240);
      if(food||books){dining(main,960,355,190);dining(main,960,700,190);}
      else{place(main,'workstation',990,720,240);place(main,'planter',160,720,75);}
      if(food)dining(main,260,700,190);
      else if(books)place(main,'bookcase',210,720,250);
      else place(main,'pantry',310,720,190);
    }
    if(food){place(workroom,'hearth',105,190,130);place(workroom,'workstation',300,200,160);}
    else {place(workroom,'workstation',130,200,180);place(workroom,'pantry',330,170,110);}
    place(office,'bookcase',100,170,130);place(office,'workstation',305,200,160);
    residents=[{x:260,y:830},{x:950,y:830},{x:300,y:245}];populationLimit=9;
    visitorPositions=[{x:260,y:830},{x:950,y:830},{x:960,y:1180},{x:260,y:1180}];
    occupants.push(
      person('shop-assistant',cloth?'Clothing assistant':use==='bakery'?'Pastry seller':use==='restaurant'?'Dining room server'
        :books?'Bookseller’s assistant':'Apothecary assistant','npc_attendant',260,830,
        [cloth?'The samples are on the shelves. Fittings and alterations are measured at the worktable.'
          :food?'Fresh dishes come through from the preparation room. The cross aisle stays clear for serving.'
            :books?'The reading tables are yours to use. Please return each volume to its shelf.'
              :'Prepared remedies stay on the labeled shelves, away from the preparation bench.']),
      person('shop-worker',cloth?'Seamster':food?'Baker & kitchen hand':books?'Bookbinder':'Remedy maker','npc_blacksmith',300,245,
        [cloth?'Cloth is cut here before the seams are stitched. Every garment starts with a careful measurement.'
          :food?'The next batch is almost ready. The finished food goes straight to the counter.'
            :books?'Loose bindings are repaired in this workroom before the books return to the shelves.'
              :'Ingredients are weighed in small batches. The ledger records every preparation.']),
      person('shop-visitor',food?'Dining guest':cloth?'Fitting customer':books?'Reader':'Remedy customer','npc_villager',950,830,
        [food?'A quiet table and something fresh from the kitchen. A pleasant break from the road.'
          :cloth?'I am choosing a sturdy cloth for the next journey. A good fit matters on a long road.'
            :books?'I have been looking for an account of the old roads. Perhaps it is here.'
              :'I came to collect the preparation that was set aside for my household.']),
    );
  }else if(profile==='inn'){
    const main=room('common','Taproom & travelers’ tables','tavern',0,600,1440,1020);
    const kitchen=room('kitchen','Kitchen & serving pantry','kitchen',0,0,440,440,1);
    const west=room('guest-west','West guest chamber','bedroom',540,0,360,440,1);
    const east=room('guest-east','East guest chamber','bedroom',1080,0,360,440,1);
    passage(160,420,1120,200);passage(600,1600,240,180);entrance={x:720,y:1690};
    aisle(600,600,240,1020);aisle(100,1050,1240,130);
    place(main,'counter',260,235,280);place(main,'pantry',150,120,180);place(main,'barrel',480,170,80);
    place(main,'barrel',560,170,70);place(main,'pantry',1030,120,210);
    place(main,'hearth',1260,170,170);
    dining(main,320,400);dining(main,1040,400);dining(main,320,730);dining(main,1080,730);
    place(main,'bench',180,935,180);place(main,'bench',1270,935,180);place(main,'rug',720,880,180);
    place(kitchen,'hearth',115,190,150);place(kitchen,'pantry',330,170,135);place(kitchen,'workstation',300,350,180);
    for(const chamber of [west,east]){
      place(chamber,'bed',100,230,110);place(chamber,'wardrobe',285,185,90);place(chamber,'chest',285,355,85);
    }
    residents=[{x:120,y:910},{x:1040,y:1025},{x:360,y:1450}];
    visitorPositions=[{x:300,y:1025},{x:920,y:1025},{x:1160,y:1025},{x:1020,y:760},
      {x:90,y:1300},{x:520,y:1300},{x:360,y:1450},{x:500,y:1450},
      {x:880,y:1300},{x:1350,y:1310},{x:980,y:1450},{x:1120,y:1450}];
    populationLimit=18;
    const traveler=(id:string,role:string,family:InteriorOccupant['family'],slot:number,region:RegionId,lines:readonly string[])=>{
      const p=visitorPositions![slot],tableX=p.x<720?320:1080,tableY=p.y<1100?947.5:1277.5;
      return {...person(id,role,family,p.x,p.y,lines,{x:tableX-p.x,y:tableY-p.y}),lookAt:{x:tableX,y:tableY},visualRegion:region,
        ancestry:region==='narenthil'?'elf' as const:region==='rindass'?'orc' as const:region==='druganwoods'?'dwarf' as const:'human' as const};
    };
    occupants.push(
      person('server','Taproom server','npc_attendant',520,980,['Fresh bread is coming from the kitchen. Keep the middle aisle free for the trays.']),
      person('cook','Kitchen cook','npc_blacksmith',150,355,['Mind the hot pans. Supper does not cook itself.']),
      traveler('regular','Ale drinker','npc_adventurer',0,'trandum',['A warm room and a full cup make the road seem shorter.','The next round can wait until the stew arrives.']),
      traveler('guest','Traveling guest','npc_villager',1,'narenthil',['There is room at our table if you have a story worth sharing.']),
      traveler('companion','Caravan companion','npc_blacksmith',6,'druganwoods',['We came in before the rain. A good inn is worth remembering.']),
      traveler('drover','Clan drover','npc_adventurer',8,'rindass',['A long road and a shared meal. Everyone at this table has earned both.']),
      traveler('sailor','Off-duty sailor','npc_adventurer',2,'portquill',['There are better stories on shore than in the cargo hold.']),
      traveler('scholar','Elven wayfarer','npc_attendant',3,'narenthil',['I collect the songs people sing far from home. Have you heard the local verses?']),
      traveler('factor','Dwarven trade factor','npc_adventurer',7,'druganwoods',['Business can wait until after supper. Pass the bread.']),
      traveler('porter','Orc road porter','npc_general',9,'rindass',['My companions went ahead to the market. I promised to keep a place at the table.']),
      person('carter','Off-duty carter','npc_general',90,1300,['I leave before first light. Tonight, this table is as far as I travel.'],{x:1,y:0}),
      traveler('hunter','Northern traveler','npc_villager',10,'frostlands',['A roof, warm food and company. This was a good stop.']),
      person('neighbor','Local neighbor','npc_attendant',1120,1450,['The common room is where everyone catches up after work.'],{x:0,y:-1}),
    );
    occupants[0].stroll={x:520,y:1210};
  }else if(profile==='guild'){
    const harbor=/harbor|harbour/i.test(name),mine=/mine/i.test(name),seed=/seed/i.test(name);
    const work=harbor?'shipping contracts':mine?'ore consignments':seed?'seed orders':'craft commissions';
    const main=room('hall','Guildhall & contract tables','guild',0,540,1320,820);
    const records=room('records','Guild records & accounts','office',0,0,480,380,1);
    const craft=room('workroom',harbor?'Charts & rigging room':mine?'Assay & equipment room':seed?'Seed grading room':'Members’ workroom','workshop',800,0,520,380,1);
    passage(160,360,1000,200);passage(540,1340,240,180);entrance={x:660,y:1430};
    aisle(550,540,220,820);aisle(80,1010,1160,120);
    dining(main,295,335,260);dining(main,1020,335,240);
    place(main,'counter',1030,675,270);place(main,'bookcase',180,160,200);place(main,'signature',1090,140,140);
    place(main,'bench',210,720,210);place(main,'rug',660,620,190);
    place(records,'bookcase',120,180,160);place(records,'workstation',340,285,190);
    place(craft,'workstation',160,220,230);place(craft,'wardrobe',420,190,130);
    residents=[{x:1030,y:1310},{x:295,y:1000},{x:1020,y:1000}];
    occupants.push(
      person('clerk','Guild clerk','npc_attendant',1030,1310,['The ledger for '+work+' stays here. Completed work is checked at this counter.']),
      person('member',harbor?'Ship captain':mine?'Mining foreman':seed?'Seed merchant':'Guild member','npc_adventurer',295,1000,
        [harbor?'The tide decides when we sail. These charts decide whether we return.':mine?'The next shift needs sound supports and counted tools. We plan both at this table.':seed?'Every sack is labeled by crop and harvest. A good seed order begins with careful records.':'We are comparing routes before we accept another job. A plan saves more lives than bravado.']),
      person('artisan','Visiting artisan','npc_blacksmith',1020,1000,['The guild keeps samples of every approved fitting. Consistent work keeps the town standing.']),
      person('scribe','Guild archivist','npc_general',340,340,['Names, deliveries, dues. There is a person behind every line in these books.']),
      person('apprentice','Guild apprentice','npc_villager',960,340,['I am still learning. The master checks every joint before it leaves this room.']),
    );
  }else{
    const stable=profile==='stable';
    const laneWidth=stable?Math.max(STABLE_ENTRANCE.aisleWidth,stableDoorWidth*STABLE_ENTRANCE.outerHalf*2/STABLE_ENTRANCE.clearRatio+64):240;
    const width=stable?Math.max(1440,laneWidth+960):1080;
    const main=room('main',stable?'Stall bays & grooming aisle':profile==='armory'?'Armory & issue counter':'Cargo aisles & tally station',
      stable?'stable':profile==='armory'?'armory':'storage',0,420,width,stable?1000:820);
    const west=room('west',stable?'Tack room':profile==='armory'?'Equipment stores':'Reserve stock',stable?'workshop':'storage',0,0,420,280,1);
    const east=room('east',stable?'Feed & harness store':profile==='armory'?'Repair bench':'Receiving office',
      profile==='store'?'office':'workshop',width-420,0,420,280,1);
    passage(160,260,width-320,180);passage(width/2-laneWidth/2,main.y+main.height-20,laneWidth,180);
    entrance={x:width/2,y:main.y+main.height+80};
    aisle(width/2-laneWidth/2,420,laneWidth,main.height);
    if(!stable)aisle(60,835,width-120,125);
    if(stable){
      const bay=(width-laneWidth)/2,railWidth=bay-100;
      // Three open-front stall bays per side. The continuous dirt cart aisle
      // never shares a footprint with a rail, trough, hay bale or supply rack.
      for(const side of [-1,1]){
        const center=side<0?bay/2:width-bay/2,wall=side<0?110:width-110;
        for(let row=0;row<3;row++){
          place(main,'chest',center,265+row*310,Math.min(300,bay-140),'stable-bedding',0,true);
          place(main,'bench',center,300+row*310,railWidth);
          place(main,'chest',wall,190+row*310,140);
        }
        place(main,'chest',side<0?bay-130:width-bay+130,150,140,'stable-hay');
        place(main,'barrel',side<0?bay-105:width-bay+105,800,85);
      }
      place(west,'wardrobe',115,190,150,'stable');place(west,'workstation',320,190,130,'stable-gear');
      place(east,'chest',110,190,130,'stable-hay');place(east,'pantry',305,190,170,'stable');
      residents=[{x:bay-75,y:805},{x:width-bay+75,y:1370},{x:320,y:235}];
      visitorPositions=[...residents];populationLimit=6;
      occupants.push(
        person('groom','Stable groom','npc_villager',residents[0].x,residents[0].y,['Fresh water first, then a rubdown. Road animals have earned a quiet rest.']),
        person('handler','Caravan handler','npc_adventurer',residents[1].x,residents[1].y,['Harnesses are checked here before the wagons leave. Keep the long aisle open.']),
        person('tackkeeper','Tack keeper','npc_blacksmith',320,235,['A worn strap is cheaper to replace here than halfway up a mountain.']),
      );
    }else{
      for(const x of [190,width-190]){
        place(main,profile==='armory'?'wardrobe':'pantry',x,260,200);
        place(main,'chest',x,385,160);
        place(main,profile==='armory'?'workstation':'barrel',x,690,profile==='armory'?230:95);
      }
      place(west,'pantry',115,190,160);place(west,'chest',330,200,100);
      place(east,'workstation',150,185,210);place(east,'bookcase',335,170,110);
      residents=[{x:width-190,y:1200},{x:190,y:1200},{x:150+east.x,y:260}];
      occupants.push(
        person('keeper',profile==='armory'?'Armory quartermaster':'Warehouse keeper','npc_general',width-190,1200,
          [profile==='armory'?'Count the returned blades before issuing fresh equipment. Nothing leaves this room without a record.':'Cargo is sorted by destination. Leave the central aisle clear for the next delivery.']),
        person('worker',profile==='armory'?'Armorer':'Warehouse porter','npc_blacksmith',190,1200,
          [profile==='armory'?'A loose rivet can ruin a perfectly good breastplate. I check them one at a time.':'Heavy goods on the lower shelves. The tally clerk will show you where the next load belongs.']),
        person('clerk',profile==='armory'?'Equipment clerk':'Cargo tally clerk','npc_attendant',east.x+150,240,
          ['The ledger stays beside the goods. It is much harder to lose a delivery that way.']),
      );
    }
  }
  return {rooms,floors,objects,occupants,aisles,residents,entrance,visitorPositions,populationLimit,
    entranceWidth:profile==='stable'?stableDoorWidth:180,
    entranceHeight:profile==='stable'?stableDoorHeight:150};
}

/** Smaller workplaces retain their established floor plan and quest positions. */
export function supportingInteriorOccupants(profile:InteriorProfile,rooms:readonly InteriorRoom[]):InteriorOccupant[]{
  if(profile==='home'||profile==='villa'||profile==='cave')return [];
  const staff:InteriorOccupant[]=[];
  for(const r of rooms){
    if(profile==='castle'&&!['kitchen','dining'].includes(r.kind))continue;
    if(!['workshop','archive','office','market','barracks','kitchen','council','chapel','dining'].includes(r.kind))continue;
    const role=r.kind==='workshop'?'Workshop apprentice':r.kind==='archive'||r.kind==='office'?'Records clerk':r.kind==='market'?'Market customer'
      :r.kind==='barracks'?'Off-duty guard':r.kind==='kitchen'?'Kitchen helper':r.kind==='chapel'?'Temple attendant':r.kind==='dining'?'Household attendant':'Hall steward';
    const family:InteriorOccupant['family']=r.kind==='workshop'?'npc_blacksmith':r.kind==='barracks'?'npc_general':r.kind==='market'?'npc_villager':'npc_attendant';
    staff.push(person(r.id+'-staff',role,family,r.x+r.width*.28,r.y+r.height-45,
      [r.kind==='workshop'?'There is always another repair waiting on the bench.':r.kind==='kitchen'||r.kind==='dining'?'Meals arrive on time when everyone keeps the serving path clear.'
        :r.kind==='archive'||r.kind==='office'?'Please keep the records in their proper order. Someone will need them after us.':r.kind==='chapel'?'A quiet place is a kindness after a long road.'
          :r.kind==='barracks'?'Off duty for the moment. My equipment will be ready for the next watch.':'There is always work to do when a town is this busy.']));
    if(staff.length>=4)break;
  }
  return staff;
}

/** Keep overnight service contacts, with busier common rooms after work. */
export function interiorOccupantAvailable(profile:InteriorProfile,occupant:InteriorOccupant,hour:number){
 if(profile==='inn'){
  if(['server','cook','guest'].includes(occupant.id))return true;
  if(['carter','porter','neighbor'].includes(occupant.id))return hour>=17||hour<2;
  if(occupant.id==='factor')return hour>=11&&hour<24;
  if(occupant.id==='hunter')return hour>=15||hour<3;
  return hour>=7||hour<2;
 }
 if(occupant.id.startsWith('shop-'))return hour>=7&&hour<22;
 if(profile==='guild')return occupant.id==='clerk'||hour>=7&&hour<(occupant.id==='scribe'?22:20);
 if(profile==='stable')return occupant.id==='handler'||hour>=6&&hour<22;
 if(profile==='armory'||profile==='store')return occupant.id==='keeper'||hour>=6&&hour<21;
 return true;
}
