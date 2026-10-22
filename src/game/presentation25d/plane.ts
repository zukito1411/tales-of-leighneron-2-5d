import type Phaser from 'phaser';

export type PresentationPlane = 'ground' | 'upright' | 'screen';
export interface PresentationHint {
  plane: PresentationPlane;
  /** Keep attachments, names and health bars on their owner's foot plane. */
  anchor?: {x:number;y:number;depth?:number};
}
export const PRESENTATION_HINT = 'presentation25d';
export function onPlane<T extends Phaser.GameObjects.GameObject>(object:T,plane:PresentationPlane,anchor?:{x:number;y:number;depth?:number}):T {
  const current=object.getData(PRESENTATION_HINT) as PresentationHint|undefined;
  if(current?.plane===plane&&current.anchor===anchor)return object;
  object.setData(PRESENTATION_HINT,{plane,anchor} satisfies PresentationHint);
  return object;
}

/** Fixed orthographic elevation shared by the Three renderer and terrain streaming.
 * On an inclined ground plane, a screen-height of terrain spans 1/sin(elevation)
 * more world units than the Phaser camera's original unprojected 2D rectangle. */
export const CAMERA_ELEVATION = 45 * Math.PI / 180;
export const CAMERA_SIN = Math.sin(CAMERA_ELEVATION);
export const CAMERA_COS = Math.cos(CAMERA_ELEVATION);

export function projectedGroundView(
  camera: Pick<Phaser.Cameras.Scene2D.Camera, 'width' | 'height' | 'zoom'>,
  x: number, y: number, margin = 0,
) {
  const halfWidth = camera.width / (2 * camera.zoom) + margin;
  const halfHeight = camera.height / (2 * camera.zoom * CAMERA_SIN) + margin;
  return {left:x-halfWidth,right:x+halfWidth,top:y-halfHeight,bottom:y+halfHeight};
}
