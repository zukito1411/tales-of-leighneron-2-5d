import type {TownDefinition,Vec2,WorldPropTexture} from '../game/types';
import {TOWN_BY_ID} from './towns';
import {SETTLEMENT_PROFILES,type SettlementProfileId} from './settlementProfiles';
import type {BuildingLot,LandParcel,Planting,Street} from './settlements';
import type {Rect} from './settlementGeometry';

export interface WardDetail extends Vec2 {
  id:string; texture:WorldPropTexture; frame:number; scale:number;
  solid:boolean; label?:string;
}
interface WardTheme {
  names:readonly [string,string]; livelihoods:readonly [string,string];
  use:'croft'|'grove'|'trade'|'military'|'forge'|'quay';
}
// Land use is authored per settlement, not chosen by random building frames.
export const WARD_THEMES:Record<SettlementProfileId,WardTheme>={
  oakmere:{names:['Orchard Crofts','Wainwright Green'],livelihoods:['fruit growers and shared bread ovens','cart repairs and farm deliveries'],use:'croft'},
  highmere:{names:['Weavers Borough','East Guild Commons'],livelihoods:['weaving households and cloth factors','craft guilds and caravan suppliers'],use:'trade'},
  willowcross:{names:['Drovers Green','Fletchers Reach'],livelihoods:['caravan lodging and fodder storage','bow making and river-road provisions'],use:'trade'},
  elarion:{names:['Whitebough Gardens','Livingwood Terrace'],livelihoods:['healers and lore-copying households','bowyers and tended woodland'],use:'grove'},
  moonfall:{names:['Moonherb Crofts','Keepers Copse'],livelihoods:['medicinal gardens and seed exchange','grove keepers and pilgrims'],use:'grove'},
  starhold:{names:['Ropemakers Terrace','Winter Provision Ward'],livelihoods:['rope makers and pass guides','winter stores and caravan quarters'],use:'military'},
  redmesa:{names:['Herders Common','Ember Clan Yard'],livelihoods:['herder households and fodder plots','clan smiths and rider supplies'],use:'croft'},
  deepford:{names:['Stonecutters Close','Boatwright Borough'],livelihoods:['stone masons and quarry stores','boat fittings and timber merchants'],use:'forge'},
  tidewatch:{names:['Netmenders Close','Chandlers Quarter'],livelihoods:['fishing families and net repair','ship chandlers and bonded stores'],use:'quay'},
  skallheim:{names:['Pine Clan Close','Fishcurers Yard'],livelihoods:['winter households and pine carpenters','fish curing and harbor supplies'],use:'quay'},
  blackspire:{names:['Chainwright Close','Furnace Supply Ward'],livelihoods:['chainworkers and their households','fuel merchants and forge provisions'],use:'forge'},
  'cibar-plains':{names:['Seedkeepers Crofts','Waterturn Common'],livelihoods:['seed storage and grain growers','irrigation keepers and tool repair'],use:'croft'},
};

export function wardActivityPoints(townId:string,side:-1|1) {
  const profile=SETTLEMENT_PROFILES[townId as SettlementProfileId],hy=profile.bounds.height/2+160;
  const avenue=side*(profile.bounds.width/2+260);
  return {
    work:{x:avenue+side*340,y:hy*.24+120},
    social:{x:avenue,y:100},
    home:{x:avenue+side*90,y:-hy*.28+120},
  };
}

export interface WardPlan {streets:Street[];parcels:LandParcel[];buildings:BuildingLot[];plantings:Planting[];details:WardDetail[]}
export function settlementWardPlan(town:TownDefinition):WardPlan {
  const profile=SETTLEMENT_PROFILES[town.id as SettlementProfileId],theme=WARD_THEMES[profile.id];
  const half=profile.bounds.width/2,hy=profile.bounds.height/2+160;
  const result:WardPlan={streets:[],parcels:[],buildings:[],plantings:[],details:[]};
  const urban=town.kind==='capital'||town.kind==='stronghold';
  const columns=town.id==='highmere'?6:urban?4:town.kind==='village'?2:3;
  const spacing=urban?440:380;
  const laneWidth=town.id==='highmere'?84:town.kind==='village'?52:68;
  for(const side of [-1,1] as const){
    const index=side===-1?0:1,ward=theme.names[index],id=`ward:${town.id}:${index}`;
    const avenue=half+260,toPoint=(x:number,y:number):Vec2=>({x:side*x,y});
    const addStreet=(name:string,width:number,points:Vec2[],surface:'stone'|'dirt'=urban?'stone':'dirt')=>result.streets.push({id:id+':'+name,width,points,surface});
    // The burgage spine is outside old lots; the shared east/west road connects
    // the new neighborhoods to the civic center without cutting existing homes.
    addStreet('market-connection',laneWidth,[toPoint(half-160,0),toPoint(half+2*hy-180,0)],town.kind==='village'?'dirt':'stone');
    addStreet('burgage-spine',laneWidth,[toPoint(avenue,-hy*.72),toPoint(avenue,hy*.86)]);
    const rows=[-hy*.28,hy*.24,hy*.65];
    for(const [row,y] of rows.entries()){
      const end=half+160+2*(hy-Math.abs(y+120))-180;
      addStreet('terrace:'+row,row===2?48:56,[toPoint(avenue,y+120),toPoint(end,y+120)],row===2||theme.use==='croft'?'dirt':urban?'stone':'dirt');
      // Outer terraces are productive gardens, not another identical house row.
      if(row===2){
        const terrain=theme.use==='croft'?'farmland':theme.use==='grove'?'forest':town.regionId==='frostlands'||town.regionId==='nardorous'?'snow':'grass';
        result.parcels.push({id:terrain==='farmland'?`farm:${town.id}:ward:${index}`:id+':garden',
          purpose:theme.use==='croft'?'Household allotments with an open harvest lane':ward+' communal garden and shelter planting',
          terrain,x:side*(avenue+260),y:y-120,width:360,height:220});
        addStreet('allotment-access',40,[toPoint(avenue+260,y+120),toPoint(avenue+260,y-120)],'dirt');
        continue;
      }
      for(let col=0;col<columns;col++){
        const x=avenue+340+col*spacing;
        // Smaller households are the majority. Special buildings have a real
        // neighborhood function; gatehouse/castle frames never become houses.
        const special=col===0&&row===1;
        const stoneHouse=urban&&(theme.use==='forge'||theme.use==='military'||row===0&&col>=columns-2);
        const frame=special?(theme.use==='forge'?5:theme.use==='quay'?7:theme.use==='military'?6:theme.use==='grove'?4:theme.use==='trade'?7:6):stoneHouse&&row===0&&col>=columns-2?1:0;
        const scale=special ? .78 : stoneHouse ? .95 : town.kind==='village'?1.05:1.15;
        const plot:Rect={left:side===1?x-spacing/2: -x-spacing/2,right:side===1?x+spacing/2:-x+spacing/2,
          top:y-(urban?390:330),bottom:y+56};
        result.buildings.push({...toPoint(x,y),frame,scale,wardId:id,plot,
          label:special?`${ward} ${theme.use==='forge'?'Workshop':theme.use==='quay'?'Stores':theme.use==='military'?'Stable':theme.use==='grove'?'Chapel':theme.use==='trade'?'Guild Store':'Farm Stable'}`:`${ward} ${row===0?'Upper':'Lower'} House ${col+1}`,
          purpose:special?theme.livelihoods[index]:'Burgage household; workshop front, dwelling and shared rear garden',
          appearance:{texture:town.id==='elarion'?'elven_villas':special||stoneHouse?'capital_buildings':'world_buildings',frame},
        });
      }
    }
    result.parcels.push({id:id+':market-green',purpose:ward+' well, market and gathering place',terrain:town.kind==='village'?'grass':'stone',
      x:side*(avenue+220),y:40,width:440,height:360});
    // Taller trees occupy rear garden bands, never the shop fronts or road.
    for(const [i,[x,y]] of [[avenue+240,-hy*.6],[avenue+500,-hy*.6],[avenue+300,hy*.84],[avenue+580,hy*.78]].entries())
      result.plantings.push({id:id+':tree:'+i,...toPoint(x,y),frame:town.regionId==='frostlands'||town.regionId==='nardorous'?1:0,
        scale:town.kind==='village'?1.15:1.3,wardId:id,purpose:ward+' rear garden shade and wind shelter'});
    const detail=(name:string,x:number,y:number,frame:number,scale:number,solid=true,label?:string)=>result.details.push({
      id:id+':'+name,...toPoint(x,y),texture:'others',frame,scale,solid,...(label?{label}:{})});
    detail('well',avenue+110,240,6,.64,true,ward+' shared well');
    detail('stall',avenue+230,-100,5,.6,true);
    detail('bench',avenue+150,170,7,.55,false);
    detail('notice',avenue+150,-100,11,.5,true);
    detail('lamp',avenue+110,-170,town.kind==='village'?0:1,.48,false);
    detail('lower-lamp',avenue+110,hy*.24+215,town.regionId==='darkav'?3:2,.5,false);
    detail('work-stock',avenue+240,hy*.24+220,theme.use==='quay'?8:9,.55,true);
    if(urban)detail('fountain',avenue+200,180,10,.75,true);
    // A modest outer belvedere turns the narrow triangular tip into a sight,
    // while the diagonal curtain and its corner tower keep a clear patrol apron.
    const outlook=half+1.65*hy;
    result.parcels.push({id:id+':outlook',purpose:ward+' wall-side outlook and resting court',terrain:urban?'stone':'grass',x:side*outlook,y:0,width:280,height:240});
    detail('outlook-bench',outlook,110,7,.5,false,ward+' outlook');
    detail('outlook-lamp',outlook,-65,0,.42,false);
    for(const bank of [-1,1] as const){
      result.parcels.push({id:theme.use==='croft'?`farm:${town.id}:outer-common:${index}:${bank}`:id+':outer-garden:'+bank,
        purpose:theme.use==='croft'?'Protected household crop strips beside the public approach':ward+' planted commons and shaded approach',
        terrain:theme.use==='croft'?'farmland':theme.use==='grove'?'forest':town.regionId==='nardorous'||town.regionId==='frostlands'?'snow':'grass',
        x:side*(half+hy*1.24),y:bank*hy*.16,width:hy*.45,height:hy*.3});
      if(theme.use==='croft')addStreet('common-harvest-access:'+bank,40,[toPoint(half+hy*1.24,0),toPoint(half+hy*1.24,bank*hy*.16)],'dirt');
    }
    // An avenue of spaced shade trees connects the borough to its outer outlook.
    // Full-silhouette fitting subsequently rejects crops, houses and curtain
    // seams; no wilderness-scatter algorithm is used inside the enclosure.
    for(let x=avenue+600,column=0;x<outlook-180;x+=360,column++)for(const bank of [-1,1] as const)
      result.plantings.push({id:id+':avenue-tree:'+column+':'+bank,...toPoint(x,bank*330),
        frame:town.regionId==='nardorous'||town.regionId==='frostlands'?1:0,scale:1.15,wardId:id,
        purpose:ward+' shaded public approach; keep canopy and trunk clear of circulation'});
    if(theme.use!=='croft')for(const [i,x] of [avenue+800,avenue+1160,avenue+1520].entries()){
      detail('commons-bench:'+i,x,140,7,.5,false);
      detail('commons-lamp:'+i,x,-100,town.regionId==='darkav'?3:1,.45,false);
      if(theme.use==='trade'||theme.use==='quay')detail('commons-stall:'+i,x+150,-100,5,.55,true);
    }
    // Regional work/garden courts have their own authored palette. These
    // anchors are fitted against roads, whole roofs, trees and residents by
    // prepareLayout; a busy court omits decoration instead of blocking access.
    const regional=(name:string,x:number,y:number,texture:WorldPropTexture,frame:number,scale:number,solid=false)=>
      result.details.push({id:id+':regional:'+name,...toPoint(x,y),texture,frame,scale,solid});
    if(town.regionId==='rindass'){
      regional('herder-tent',avenue+660,-hy*.56,'desert_props',9,1.05,true);
      regional('fodder-stocks',avenue+980,-hy*.52,'desert_props',8,.55,true);
      regional('cart-repair',avenue+760,hy*.43,'desert_props',6,.72,true);
      regional('clan-waymarker',avenue+170,-hy*.55,'desert_props',7,.48,true);
      regional('old-clan-arch',outlook-180,-150,'desert_props',11,1.2,true);
      regional('courtyard-cactus',avenue+450,hy*.48,'desert_props',0,.8,true);
    }else if(town.regionId==='frostlands'||town.regionId==='nardorous'){
      regional('winter-beacon',avenue+420,-hy*.58,'climate_props',5,.68,true);
      regional('snow-fence',avenue+700,hy*.48,'climate_props',4,.74,true);
      regional('snow-outcrop',outlook-150,-200,'climate_props',3,.88,true);
      regional('winter-garden',avenue+700,-hy*.58,'climate_props',1,1.2,true);
      if(town.regionId==='frostlands')regional('ice-marker',outlook-90,190,'climate_props',2,.72,true);
    }else if(town.regionId==='darkav'){
      regional('forge-flame',avenue+420,-hy*.56,'climate_props',9,.75,true);
      regional('ward-runes',outlook-180,-180,'climate_props',10,1.05,true);
      regional('basalt-garden',avenue+800,hy*.48,'climate_props',7,1.1,true);
      regional('ember-stores',avenue+700,-hy*.58,'climate_props',6,.55,true);
    }else{
      regional('rear-flowers',avenue+460,-hy*.6,'woodland_props',1,.42);
      regional('garden-shrub',avenue+750,-hy*.6,'woodland_props',4,.5);
      regional('herb-ferns',avenue+550,hy*.5,'woodland_props',2,.4);
      if(theme.use==='forge'||theme.use==='quay'||town.id==='oakmere'){
        regional('timber-yard',avenue+800,hy*.43,'woodland_props',6,.78,true);
        regional('cut-stump',avenue+1030,hy*.43,'woodland_props',7,.42,true);
      }
      if(theme.use==='grove'){
        regional('old-growth-stump',outlook-150,-180,'woodland_props',7,.75,true);
        regional('grove-mushrooms',outlook-120,170,'woodland_props',10,.26);
      }
      regional('garden-waymarker',avenue+130,-hy*.5,'woodland_props',11,.42,true);
    }
  }
  return result;
}

export const settlementWardName=(townId:string,side:-1|1)=>WARD_THEMES[TOWN_BY_ID[townId].id as SettlementProfileId].names[side===-1?0:1];
