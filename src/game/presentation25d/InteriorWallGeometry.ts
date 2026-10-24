import {ModelMesh,masonry,type Patch} from './ModelMesh';

export interface InteriorWallPanel {uv:Patch;kit:string}

/** A complete solid panel, with the original prepared wall artwork on both
 * elevations. Transparent frame gutters reveal masonry, never the black void.
 * World span/height/thickness belong to its instance, not sprite padding. */
export function createInteriorWallGeometry(panel:InteriorWallPanel){
  const m=new ModelMesh({left:0,top:0,width:1,height:1});
  // Put the underside below the floor and the art far enough in front of
  // its backing for mobile depth precision at large world coordinates.
  m.box(-.5,.5,-.51,.5,-.5,.5,masonry(panel.kit));
  m.cutout([-.5,-.5,.52],[.5,-.5,.52],[-.5,.5,.52],[.5,.5,.52],panel.uv);
  m.cutout([.5,-.5,-.52],[-.5,-.5,-.52],[.5,.5,-.52],[-.5,.5,-.52],panel.uv);
  return m.finish();
}
