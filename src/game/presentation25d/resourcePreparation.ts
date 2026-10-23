import type Phaser from 'phaser';
interface Preparation {request:(source:Phaser.Textures.TextureSource)=>void;ready:(source:Phaser.Textures.TextureSource)=>boolean}
const preparations=new WeakMap<Phaser.Game,Preparation>();
export function bindResourcePreparation(game:Phaser.Game,preparation:Preparation){preparations.set(game,preparation);}
export function clearResourcePreparation(game:Phaser.Game){preparations.delete(game);}
/** Existing Phaser-only fixtures do not need a second renderer upload fence. */
export function preparePresentationSource(game:Phaser.Game,source:Phaser.Textures.TextureSource){
  const preparation=preparations.get(game);if(!preparation)return true;
  preparation.request(source);return preparation.ready(source);
}
