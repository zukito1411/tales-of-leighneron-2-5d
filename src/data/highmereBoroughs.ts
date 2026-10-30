import type {Vec2} from '../game/types';
import type {BuildingLot,LandParcel,Planting} from './settlements';
import type {WardDetail} from './settlementWards';

/** Existing building slots keep their IDs and indoor occupants. Their public
 * functions now occupy the districts rather than the old miniature core. */
export const HIGHMERE_CORE_SITES:Readonly<Record<string,Vec2>>={
  'Crown Watch':{x:-4800,y:-450},'Royal Archive':{x:-3500,y:-3900},
  'West Barracks':{x:-3800,y:-450},'Crown Stable':{x:3800,y:700},
  'Charter House':{x:-1600,y:700},'North Bridge Watch':{x:4850,y:-450},
  'Market Hall':{x:-2700,y:700},'Counting House':{x:-3800,y:700},
  'River Customs':{x:4900,y:700},'Westgate Inn':{x:-4900,y:700},
  'Westgate Homes':{x:-4900,y:1900},'East Bridge Watch':{x:5300,y:250},
  'Guild Forge':{x:2800,y:1900},'Craft Guild':{x:3900,y:1900},
  'South Homes':{x:-1750,y:3000},'Orchard Lane':{x:-3950,y:3000},
  'South Smithy':{x:4900,y:1900},'Caravan Storehouse':{x:1750,y:3000},
  'Knights Headquarters':{x:2700,y:700},'Royal Armory':{x:2700,y:-450},
  'Ambassadors House':{x:-2500,y:-3900},'Cloth Exchange':{x:-650,y:700},
  'Eastern Granary':{x:3650,y:4100},'South Caravan Stable':{x:2850,y:3000},
};

export interface CapitalCourt extends Vec2 {id:string;streetY:number;district:string}
/** A household occupies the north side; its doorstep, neighbors and walking
 * lane occupy the south side. Courts are also the population's activity plan. */
export const HIGHMERE_HOUSEHOLD_COURTS:readonly CapitalCourt[]=[
  {streetY:2200,xs:[650,1750,2850,3950,5000]},
  {streetY:3300,xs:[650,1750,2850,3950]},
  {streetY:4400,xs:[650,1750,2850,3650]},
  {streetY:5200,xs:[650]},
].flatMap((row,r)=>[-1,1].flatMap(side=>row.xs.map((x,c)=>({
  id:(side<0?'west':'east')+':'+r+':'+c,x:side*x,y:row.streetY-300,streetY:row.streetY,
  district:side<0?'Commoner Housing':'Rural Quarter',
}))));

export function highmereBoroughPlan(){
  const buildings:BuildingLot[]=[],parcels:LandParcel[]=[],plantings:Planting[]=[],details:WardDetail[]=[];
  const home=(id:string,label:string,p:Vec2,frame=0,stone=false)=>{
    const width=stone?950:800;
    buildings.push({...p,frame,scale:1,wardId:'capital:'+id,
      plot:{left:p.x-width/2,right:p.x+width/2,top:p.y-950,bottom:p.y+80},
      appearance:{texture:stone?'capital_buildings':'world_buildings',frame},label,
      purpose:stone?'Civic trade and household services with a public front court':'Inhabited household, rear kitchen garden and shared pedestrian approach'});
  };
  const prop=(id:string,p:Vec2,frame:number,scale:number,solid=false)=>details.push({id:'capital:'+id,...p,texture:'others',frame,scale,solid});
  for(const [i,court] of HIGHMERE_HOUSEHOLD_COURTS.entries()){
    home('house:'+court.id,court.district+' Hearth '+(i+1),court,court.x>0&&i%4===0?6:0,court.x>0&&i%4===0);
    // Whole silhouettes retain the existing palette; gardens fill the rear
    // setbacks while benches and lamps remain out of the public street.
    details.push({id:'capital:'+court.id+':herbs',x:court.x+310,y:court.y-80,texture:'woodland_props',frame:2,scale:.30,solid:false},
      {id:'capital:'+court.id+':flowers',x:court.x-310,y:court.y-50,texture:'woodland_props',frame:1,scale:.28,solid:false});
    prop(court.id+':seat',{x:court.x-260,y:court.streetY-110},7,.52);
    prop(court.id+':lantern',{x:court.x+310,y:court.streetY-125},0,.5);
    if(i%3===0)prop(court.id+':well',{x:court.x+320,y:court.y+70},6,.58,true);
  }
  // Noble courts use heraldry, paired stone seats and finished floral panels;
  // the rural ward uses practical pumps, fodder and cart-side working stores.
  for(const [i,x] of [-4400,-3400,-2500].entries()){
    prop('noble-banner:'+i,{x,y:-1150},12,.7,true);
    prop('noble-lamp:'+i,{x:x+240,y:-2300},1,.62);
    prop('noble-seat:'+i,{x:x-160,y:-1160},7,.65);
    details.push({id:'capital:noble-parterre:'+i,x:x+150,y:-2460,texture:'flower_fence',frame:0,scale:.45,solid:true});
  }
  for(const [i,x] of [1750,2850,3950].entries()){
    prop('rural-fodder:'+i,{x:x+320,y:3050},9,.6,true);
    prop('rural-water:'+i,{x:x-300,y:3060},6,.62,true);
    details.push({id:'capital:rural-cart:'+i,x:x+310,y:4200,texture:'native_story_bare',frame:4,scale:.55,solid:true});
  }
  // Shopfronts around the shared market, guild and military courts. Optional
  // plots use the same fitter as existing homes; none bypass street clearance.
  for(const [i,[x,y,label,frame]] of [
    [-2700,-450,'Guild of Cloth and Dyers',0],[-1600,-450,'Merchants Council',1],
    [1600,-450,'Eastgate Provision Hall',7],[3800,-450,'Crown Farriers Hall',5],
    [-1100,1900,'Market Bakers House',0],[-3200,1900,'Travelers Guild',0],
    [1100,1900,'Leatherworkers Hall',0],[4400,3000,'Gardeners Guild House',0],
    [-1100,4100,'Common School Annex',0],[-3300,4900,'Garden Keepers Cottage',0],
    [3500,-3900,'Temple of the Dawn',4],[2500,-3900,'Dawn Hospitallers Hall',0],
    [-4900,-2100,'Noble Garden Lodge',1],[4900,-2100,'Temple Garden Lodge',1],
  ].entries())home('service:'+i,String(label),{x:Number(x),y:Number(y)},Number(frame),true);

  for(const side of [-1,1]){
    // Fronts face the open market aisles. Stock and awnings live at the edges.
    for(let i=0;i<6;i++){
      const p={x:side*(1650+i%3*850),y:i<3?1060:1390};
      prop('market:'+side+':'+i,p,5,.72,true);
      prop('market-stock:'+side+':'+i,{x:p.x+side*180,y:p.y+140},i%2?8:9,.5,true);
    }
    for(const [i,y] of [-4000,-3200,-2200].entries()){
      const x=side*1650;
      plantings.push({id:'capital:royal-orchard:'+side+':'+i,x,y,frame:0,scale:1.15,wardId:'royal-gardens',purpose:'Tended royal side garden, clear of the keep and its processional walk'});
      prop('royal-seat:'+side+':'+i,{x:x-side*150,y:y+120},7,.6);
      details.push({id:'capital:royal-flowers:'+side+':'+i,x:x-side*110,y:y-100,texture:'woodland_props',frame:1,scale:.5,solid:false});
    }
    for(let i=0;i<6;i++){
      const y=1100+i*720;
      prop('kings-road-lamp:'+side+':'+i,{x:side*180,y},1,.55);
    }
  }
  // Distinct planted, paved and working surfaces make open spaces legible.
  parcels.push(
    {id:'capital:market-square',purpose:'Market stalls, household exchange and an open buyers aisle',terrain:'stone',x:-2800,y:1170,width:3300,height:680},
    {id:'capital:guild-court',purpose:'Guild deliveries and the eastern craft market',terrain:'stone',x:2800,y:1170,width:3300,height:680},
    {id:'capital:royal-west-parterre',purpose:'Formal planted royal garden',terrain:'grass',x:-1600,y:-3400,width:520,height:2000},
    {id:'capital:royal-east-parterre',purpose:'Formal planted royal garden',terrain:'grass',x:1600,y:-3400,width:520,height:2000},
  );
  return {buildings,parcels,plantings,details};
}
