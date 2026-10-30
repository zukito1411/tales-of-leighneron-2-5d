import type {TownDefinition,Vec2,WorldPropTexture} from '../game/types';
import type {SettlementLayout} from './settlements';
import type {WardDetail} from './settlementWards';
import type {Rect} from './settlementGeometry';

/** Designed compositions around civic courts and household/workplace fronts.
 * The layout fitter reserves circulation, roof bounds and people first. */
export function coreSettlementDressing(town:TownDefinition,layout:SettlementLayout,roofs:Rect[]):WardDetail[]{
  const result:WardDetail[]=[];
  const add=(id:string,p:Vec2,texture:WorldPropTexture,frame:number,scale:number,solid=false)=>
    result.push({id:'court:'+id,...p,texture,frame,scale,solid});
  const cold=town.regionId==='nardorous'||town.regionId==='frostlands',dry=town.regionId==='rindass',ash=town.regionId==='darkav';
  const garden=(id:string,p:Vec2)=>{
    if(cold){add(id+':snow-rock',p,'climate_props',3,.34,true);add(id+':winter-watch',{x:p.x+95,y:p.y+70},'climate_props',5,.45,true);}
    else if(dry){add(id+':sage',p,'desert_props',2,.38);add(id+':pear',{x:p.x+95,y:p.y+60},'desert_props',1,.48,true);}
    else if(ash){add(id+':basalt',p,'climate_props',7,.5,true);add(id+':embers',{x:p.x+90,y:p.y+65},'climate_props',6,.32,true);}
    else{
      add(id+':shrub',p,'woodland_props',4,.34);
      add(id+':flowers',{x:p.x-72,y:p.y+58},'woodland_props',1,.24);
      add(id+':ferns',{x:p.x+70,y:p.y+58},'woodland_props',2,.22);
    }
  };
  for(const [index,lot] of layout.buildings.entries()){
    if(lot.omitted||lot.wardId&&town.id!=='highmere')continue;
    const roof=roofs[index],frame=lot.appearance?.frame??lot.frame,texture=lot.appearance?.texture??'world_buildings';
    const front={x:lot.x,y:lot.y+105},side={x:roof.left-95,y:lot.y+20};
    const name='building:'+index;
    const role=(lot.label+' '+lot.purpose).toLowerCase();
    if(texture==='world_buildings'&&frame===4)continue; // ruins remain ruined
    if(texture==='capital_buildings'&&frame===8){
      garden(name+':royal-left',{x:roof.left-110,y:lot.y-30});garden(name+':royal-right',{x:roof.right+110,y:lot.y-30});
      add(name+':royal-bench',{x:roof.left-100,y:lot.y+125},'others',7,.68,true);continue;
    }
    if(/smith|forge|armory|workshop|fletcher|boatwright|mill/.test(role)){
      add(name+':work-stock',side,'others',9,.63,true);
      add(name+':work-barrels',{x:roof.right+82,y:lot.y+48},'others',8,.60,true);
    }else if(/stable|fodder|horse/.test(role)){
      add(name+':fodder',side,'world_assets',7,.76,true);
      if(!cold&&!dry&&!ash)add(name+':timber',{x:roof.right+125,y:lot.y+55},'woodland_props',6,.62,true);
    }else if(/inn|market|exchange|counting|customs/.test(role)){
      // Market awnings live next to commercial entrances, not in every lane.
      add(name+':stall',{x:roof.right+145,y:lot.y+105},'others',5,.78,true);
      add(name+':barrels',side,'others',8,.58,true);
      add(name+':bench',{x:front.x-120,y:front.y+58},'others',7,.62,true);
    }else if(/guard|watch|barracks|knights|military/.test(role)){
      add(name+':guard-banner',side,'others',12,.62,true);
      add(name+':guard-stores',{x:roof.right+90,y:lot.y+60},'others',9,.52,true);
    }else if(/store|granary|warehouse/.test(role)){
      add(name+':stored-crates',side,'others',9,.62,true);
      add(name+':stored-barrels',{x:roof.right+82,y:lot.y+48},'others',8,.60,true);
    }else if(/archive|ambassador|temple|chapel|shrine/.test(role)){
      add(name+':quiet-seat',side,'others',7,.64,true);
    }
    garden(name+':front-garden',{x:roof.left-105,y:lot.y+95});
  }
  // Gathering courts use the existing land-use plan, rather than random pins.
  for(const parcel of layout.parcels){
    if(!/square|central-ward|market-ward|shrine-court|river-garden|royal-gardens|orchard-yard/.test(parcel.id))continue;
    const id='public:'+parcel.id,left=parcel.x-parcel.width/2+95,right=parcel.x+parcel.width/2-95;
    garden(id+':left',{x:left,y:parcel.y+parcel.height/2-30});
    garden(id+':right',{x:right,y:parcel.y+parcel.height/2-30});
    add(id+':seat',{x:left,y:parcel.y+parcel.height/2-100},'others',7,.66,true);
    if(parcel.terrain==='stone'&&parcel.width>380){
      if(town.id!=='highmere')add(id+':notice',{x:right,y:parcel.y+60},'others',11,.62,true);
      if(!ash&&!dry)add(id+':fountain',{x:parcel.x-110,y:parcel.y+70},'others',10,.78,true);
    }
  }
  return result;
}
