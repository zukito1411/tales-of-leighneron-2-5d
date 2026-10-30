import type Phaser from 'phaser';
import type {HouseShape} from './HouseGeometry';
import type {FurnitureShape} from './FurnitureGeometry';
import type {PresentationHint} from './plane';

type ModelActor=Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;
const HOUSE_KEYS:readonly (keyof HouseShape)[]=['shopfront','tradeSign','profile','left','top','width','height','depth','ground','riseScale','floorLift','doorHeight','segment','paintRegion'];
const FURNITURE_KEYS:readonly (keyof FurnitureShape)[]=['streetStyle','art','kit','key','left','top','width','height','rise','depth','patch','footX','footY','heading','modelScale','lift','quarterTurnUV','paintOffset','ornamentX','fixedGround','pose','stonePatch','roofPatch','fire','canopy','sourceRegion','bounds'];
export interface ModelState {
  frame:Phaser.Textures.Frame;hint:PresentationHint|undefined;
  x:number;y:number;scaleX:number;scaleY:number;rotation:number;originX:number;originY:number;flipX:boolean;flipY:boolean;elevation:number;
  house:HouseShape|undefined;houseValues:HouseShape|undefined;segment:HouseShape['segment'];
  furniture:FurnitureShape|undefined;furnitureValues:FurnitureShape|undefined;
}
function elevation(actor:ModelActor){return 'presentationElevation' in actor&&typeof actor.presentationElevation==='number'?actor.presentationElevation:0;}
/** Snapshot once when a modeled actor changes. No camera/time fields: the
 * existing shared shaders still animate fire, fountains and light. */
export function captureModelState(actor:ModelActor,hint:PresentationHint|undefined):ModelState {
  const house=hint?.house,furniture=hint?.furniture;
  return {frame:actor.frame,hint,x:actor.x,y:actor.y,scaleX:actor.scaleX,scaleY:actor.scaleY,rotation:actor.rotation,
    originX:actor.originX,originY:actor.originY,flipX:actor.flipX,flipY:actor.flipY,elevation:elevation(actor),
    house,houseValues:house?{...house}:undefined,segment:house?.segment?{...house.segment}:undefined,
    furniture,furnitureValues:furniture?{...furniture}:undefined};
}
export function modelStateMatches(state:ModelState,actor:ModelActor,hint:PresentationHint|undefined,checkTransform=true){
  if(checkTransform&&(state.frame!==actor.frame||state.hint!==hint||state.x!==actor.x||state.y!==actor.y
    ||state.scaleX!==actor.scaleX||state.scaleY!==actor.scaleY||state.rotation!==actor.rotation
    ||state.originX!==actor.originX||state.originY!==actor.originY||state.flipX!==actor.flipX||state.flipY!==actor.flipY))return false;
  if(state.elevation!==elevation(actor)||state.house!==hint?.house||state.furniture!==hint?.furniture)return false;
  const house=hint?.house,furniture=hint?.furniture;
  if(house&&state.houseValues){
    for(const key of HOUSE_KEYS)if(house[key]!==state.houseValues[key])return false;
    const segment=house.segment,saved=state.segment;
    if(segment&&(!saved||segment.dx!==saved.dx||segment.dy!==saved.dy||segment.height!==saved.height||segment.thickness!==saved.thickness))return false;
  }
  if(furniture&&state.furnitureValues)for(const key of FURNITURE_KEYS)if(furniture[key]!==state.furnitureValues[key])return false;
  return true;
}
