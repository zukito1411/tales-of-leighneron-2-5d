import {CAPITAL_BUILDING_SITES} from './highmereComposition';
import type {Vec2} from '../game/types';
import type {BuildingLot,LandParcel,Planting} from './settlements';
import type {WardDetail} from './settlementWards';

export interface CapitalCourt extends Vec2 {id:string;streetY:number;district:string}
/** A household occupies the north side; its doorstep, neighbors and walking
 * lane occupy the south side. Courts are also the population's activity plan. */
export const HIGHMERE_HOUSEHOLD_COURTS:readonly CapitalCourt[]=[5,4,4,1].flatMap((count,row)=>
  [-1,1].flatMap(side=>Array.from({length:count},(_,column)=>(side<0?'west':'east')+':'+row+':'+column))
).map((id,i)=>{const site=CAPITAL_BUILDING_SITES[58+i];return {id,x:site.x,y:site.y,streetY:site.frontY,
  district:site.x<0?'Commoner Housing':'Rural Quarter'};});

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
    // setbacks while benches remain out of the public street.
    details.push({id:'capital:'+court.id+':herbs',x:court.x+310,y:court.y-80,texture:'woodland_props',frame:2,scale:.30,solid:false},
      {id:'capital:'+court.id+':flowers',x:court.x-310,y:court.y-50,texture:'woodland_props',frame:1,scale:.28,solid:false});
    prop(court.id+':seat',{x:court.x-260,y:court.streetY-110},7,.52);
    if(i%3===0)prop(court.id+':well',{x:court.x+320,y:court.y+70},6,.58,true);
  }
  // Noble courts use heraldry, paired stone seats and finished floral panels;
  // the rural ward uses practical pumps, fodder and cart-side working stores.
  for(const [i,x] of [-4400,-3400,-2500].entries()){
    prop('noble-banner:'+i,{x,y:-1150},12,.7,true);
    prop('noble-seat:'+i,{x:x-160,y:-1160},7,.65);
    details.push({id:'capital:noble-parterre:'+i,x:x+150,y:-2460,texture:'flower_fence',frame:0,scale:.45,solid:true});
  }
  for(const [i,x] of [1750,2850,3950].entries()){
    prop('rural-fodder:'+i,{x:x+320,y:3050},9,.6,true);
    prop('rural-water:'+i,{x:x-300,y:3060},6,.62,true);
    details.push({id:'capital:rural-cart:'+i,x:x+310,y:4200,texture:'native_story_bare',frame:4,scale:.55,solid:true});
  }
  // Shopfronts around the shared market, guild and military courts. Civic
  // slots retain their identities; their final survey lives in highmereComposition.
  for(const [i,[label,frame]] of ([
    ['Guild of Cloth and Dyers',0],['Merchants Council',1],['Eastgate Provision Hall',7],['Crown Farriers Hall',5],
    ['Market Bakers House',0],['Travelers Guild',0],['Leatherworkers Hall',0],['Gardeners Guild House',0],
    ['Common School Annex',0],['Garden Keepers Cottage',0],['Temple of the Dawn',4],['Dawn Hospitallers Hall',0],
    ['Noble Garden Lodge',1],['Temple Garden Lodge',1],
  ] as const).entries())home('service:'+i,label,CAPITAL_BUILDING_SITES[86+i],frame,true);

  {const side=-1;
    // Fronts face the open market aisles. Stock and awnings live at the edges.
    for(let i=0;i<6;i++){
      const p={x:side*(2000+i%3*750),y:i<3?400:850};
      prop('market:'+side+':'+i,p,5,.72,true);
      prop('market-stock:'+side+':'+i,{x:p.x+side*180,y:p.y+140},i%2?8:9,.5,true);
    }
  }
  for(const side of [-1,1]){
    for(const [i,y] of [-4000,-3200,-2200].entries()){
      const x=side*1650;
      plantings.push({id:'capital:royal-orchard:'+side+':'+i,x,y,frame:0,scale:1.15,wardId:'royal-gardens',purpose:'Tended royal side garden, clear of the keep and its processional walk'});
      prop('royal-seat:'+side+':'+i,{x:x-side*150,y:y+120},7,.6);
      details.push({id:'capital:royal-flowers:'+side+':'+i,x:x-side*110,y:y-100,texture:'woodland_props',frame:1,scale:.5,solid:false});
    }
  }
  // Distinct planted, paved and working surfaces make open spaces legible.
  parcels.push(
    {id:'capital:market-square',purpose:'Market stalls, household exchange and an open buyers aisle',terrain:'stone',x:-2800,y:650,width:2900,height:850},
    {id:'capital:guild-court',purpose:'Guild deliveries and the eastern craft market',terrain:'stone',x:2800,y:1170,width:3300,height:680},
    {id:'capital:royal-west-parterre',purpose:'Formal planted royal garden',terrain:'grass',x:-1600,y:-3400,width:520,height:2000},
    {id:'capital:royal-east-parterre',purpose:'Formal planted royal garden',terrain:'grass',x:1600,y:-3400,width:520,height:2000},
  );
  return {buildings,parcels,plantings,details};
}
