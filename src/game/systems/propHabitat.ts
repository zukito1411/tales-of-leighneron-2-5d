import {artFrameSize,type ArtTextureKey} from '../../data/art';
import type {WorldGenerator} from './WorldGenerator';
import {spriteBounds} from '../../data/settlementGeometry';
import {inTowerClearing,onTowerApproach} from '../../data/towerOfMight';

const greenGround=new Set(['grass','forest','marsh','dirt','farmland']);

function fitsGround(texture:ArtTextureKey,frame:number,world:WorldGenerator,x:number,y:number){
  const terrain=world.getTerrainAt(x,y),region=world.getRegionAt(x,y);
  if(texture==='regional_trees'){
    if(frame<=1)return (region==='portquill'||region==='rindass')&&['sand','grass','forest','dirt'].includes(terrain);
    if(frame<=3)return region==='narenthil'&&greenGround.has(terrain);
    return region==='druganwoods'&&greenGround.has(terrain);
  }
  if(texture==='climate_props')return frame<=5?terrain==='snow':frame===11?terrain==='lava':
    region==='darkav'&&['ash','stone','dirt'].includes(terrain);
  if(texture==='desert_props')return region==='rindass'&&['sand','dirt'].includes(terrain);
  if(texture==='woodland_props')return greenGround.has(terrain)
    &&(frame!==0||world.getBiomeAt(x,y)!=='coast'&&world.distanceToWater(x,y)<450);
  if(texture==='others'||texture==='world_assets'&&[0,1,2,5,6,7].includes(frame))return greenGround.has(terrain);
  if(texture==='native_story_props')return frame===3?terrain==='snow':[7,9].includes(frame)||greenGround.has(terrain);
  if(texture==='native_keepsakes')return frame===1||greenGround.has(terrain);
  if(texture==='flora')return [7,8,9].includes(frame)?['sand','dirt','grass'].includes(terrain):
    greenGround.has(terrain)&&(![5,6].includes(frame)||world.getBiomeAt(x,y)!=='coast'&&world.distanceToWater(x,y)<450);
  if(texture==='native_region_props'){
    if(frame<=2)return region==='darkav'&&['ash','stone','dirt'].includes(terrain);
    if(frame===3)return world.getBiomeAt(x,y)==='coast'&&world.distanceToWater(x,y)<750
      &&['sand','grass','dirt','stone'].includes(terrain);
    if(frame===4)return region==='rindass'&&['sand','dirt'].includes(terrain);
    if(frame===5)return region!=='darkav'&&['stone','grass','forest','dirt'].includes(terrain);
  }
  return true;
}

/** Inspect the entire illustrated ground skirt, not a single trunk/foot pixel.
 * The upper silhouette may overhang another material; its planted base may not.
 * Sampling at <=32 world units also catches narrow shore/road strips. */
export function propFitsHabitat(texture:ArtTextureKey,frame:number,world:WorldGenerator,x:number,y:number,scale=1){
  if(inTowerClearing(x,y,100)||onTowerApproach(x,y))return false;
  const bounds=spriteBounds(texture,frame,scale,x,y),height=artFrameSize(texture,frame).height*scale;
  const left=x+(bounds.left-x)*.92,right=x+(bounds.right-x)*.92;
  const top=bounds.bottom-Math.min(56,height*.18);
  const columns=Math.max(2,Math.ceil((right-left)/32)),rows=Math.max(1,Math.ceil((bounds.bottom-top)/24));
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const px=left+(right-left)*column/columns,py=top+(bounds.bottom-top)*row/rows;
    if(!world.isWalkable(px,py)&&!(texture==='climate_props'&&frame===11))return false;
    if(!fitsGround(texture,frame,world,px,py))return false;
  }
  return true;
}
