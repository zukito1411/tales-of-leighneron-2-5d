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
