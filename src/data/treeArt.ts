import {artFrameSize, type ArtTextureKey} from './art';

export type TreeTexture = 'regional_trees' | 'world_assets' | 'climate_props' | 'elarion_tree' | 'woodland_props' | 'native_region_props';
export function isTreeArt(texture: string, frame: number): texture is TreeTexture {
  return texture==='regional_trees'&&Number.isInteger(frame)&&frame>=0&&frame<6
    || texture==='native_region_props'&&frame===0
    || texture === 'elarion_tree' && frame === 0
    || texture==='woodland_props'&&frame===5
    || (texture === 'world_assets' || texture === 'climate_props') && (frame === 0 || frame === 1);
}
/** Height is measured from visible pixels, not atlas padding or source size. */
export function treeScale(texture: TreeTexture, frame: number, visibleHeight: number) {
  return visibleHeight / artFrameSize(texture, frame).height;
}
export function treeFootprint(texture: TreeTexture, frame: number, scale: number) {
  const height = artFrameSize(texture, frame).height * scale;
  // Big crowns do not mean building-sized invisible colliders. Only the trunk.
  return {width: Math.max(22, height * .115), height: Math.max(22, height * .105)};
}
export function treeLayerKey(texture: ArtTextureKey, part: 'wood' | 'leaves') {
  return `tree-layer:${texture}:${part}`;
}
