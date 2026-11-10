import type Phaser from 'phaser';
interface Preparation {
  request:(source:Phaser.Textures.TextureSource)=>void;ready:(source:Phaser.Textures.TextureSource)=>boolean;
  warm?:(source:Phaser.Textures.TextureSource)=>void;
  objectReady?:(object:Phaser.GameObjects.GameObject)=>boolean;
  viewReady?:(scene:Phaser.Scene,point:Readonly<{x:number;y:number}>)=>boolean;
}
const preparations=new WeakMap<Phaser.Game,Preparation>();
export function bindResourcePreparation(game:Phaser.Game,preparation:Preparation){preparations.set(game,preparation);}
export function clearResourcePreparation(game:Phaser.Game){preparations.delete(game);}
/** Existing Phaser-only fixtures do not need a second renderer upload fence. */
export function preparePresentationSource(game:Phaser.Game,source:Phaser.Textures.TextureSource){
  const preparation=preparations.get(game);if(!preparation)return true;
  preparation.request(source);return preparation.ready(source);
}

/** Hidden chunk scenery prepares exact model topology before publication. */
export function preparePresentationObject(game:Phaser.Game,object:Phaser.GameObjects.GameObject){
  return preparations.get(game)?.objectReady?.(object)??true;
}

/** Arrival waits for the destination camera and its complete height buffer. */
export function presentationViewReady(scene:Phaser.Scene,point:Readonly<{x:number;y:number}>){
  return preparations.get(scene.game)?.viewReady?.(scene,point)??true;
}

/** Speculative residency must never bypass the texture cache admission budget.
 * Required boot/chunk upload fences continue using preparePresentationSource. */
export function warmPresentationSource(game:Phaser.Game,source:Phaser.Textures.TextureSource){
  preparations.get(game)?.warm?.(source);
}
