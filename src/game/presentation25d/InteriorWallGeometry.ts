import {ModelMesh,masonry,type Patch} from './ModelMesh';

export interface InteriorWallPanel {uv:Patch;kit:string}

/** A complete solid panel, with the original prepared wall artwork on both
 * elevations. Transparent frame gutters reveal masonry, never the black void.
 * World span/height/thickness belong to its instance, not sprite padding. */
export function createInteriorWallGeometry(panel:InteriorWallPanel){
  const m=new ModelMesh({left:0,top:0,width:1,height:1});
  m.box(-.5,.5,-.5,.5,-.5,.5,masonry(panel.kit));
  m.cutout([-.5,-.5,.501],[.5,-.5,.501],[-.5,.5,.501],[.5,.5,.501],panel.uv);
  m.cutout([.5,-.5,-.501],[-.5,-.5,-.501],[.5,.5,-.501],[-.5,.5,-.501],panel.uv);
  return m.finish();
}
