import {expect,it} from 'vitest';
import {resolve} from 'node:path';
import {readRgbaPng,writeRgbaPng} from '../scripts/lib/png-rgba.mjs';
import {authoringOnlyAsset,publicAssetFiles,imageAlternatives} from '../scripts/lib/public-assets.mjs';
import {losslessImagePath} from '../src/utils/losslessImagePath';

it('preserves dimensions and every RGBA byte, including color below zero alpha',()=>{
 const pixels=Buffer.alloc(31*7*4);
 for(let i=0;i<pixels.length;i++)pixels[i]=(i*37+i%7)&255;
 pixels.set([217,83,46,0],0);
 const decoded=readRgbaPng(writeRgbaPng(31,7,pixels));
 expect(decoded.width).toBe(31);expect(decoded.height).toBe(7);
 expect(decoded.pixels.equals(pixels)).toBe(true);
});

it('retains runtime reference art, licenses, outfits and their registration manifests',()=>{
 const files=new Set(publicAssetFiles(resolve('public')));
 for(const path of ['assets/reference/game-load.png','assets/reference/Title.png',
  'assets/reference/Tales of Leighneron_ Sunset Valley.png','assets/reference/mernondna-world-map.jpg',
  'assets/audio/KENNEY-IMPACT-SOUNDS-LICENSE.txt','assets/audio/KENNEY-RPG-AUDIO-LICENSE.txt',
  'assets/audio/README.txt',
  'assets/characters/leigneron/awakened/varr/manifest-v1.json',
  'assets/characters/leigneron/awakened/varr/heart-v1.png','assets/characters/leigneron/awakened/varr/weapon-v1.png'])
  expect(files.has(path),path).toBe(true);
 expect([...files].some(path=>authoringOnlyAsset(path))).toBe(false);
 expect(files.has('sw.js')).toBe(false); // Generated/versioned by the offline plugin.
});

it('resolves verified alternatives consistently with the release inventory and retains PNG fallbacks',()=>{
 const publicDir=resolve('public'),files=new Set(publicAssetFiles(publicDir));
 for(const [png,webp] of Object.entries(imageAlternatives(publicDir))){
  expect(losslessImagePath(png)).toBe(webp);
  expect(files.has(webp),webp).toBe(true);expect(files.has(png),png).toBe(false);
 }
 expect(losslessImagePath('assets/reference/Title.png')).toBe('assets/reference/Title.png');
 expect(losslessImagePath('assets/future-image.png')).toBe('assets/future-image.png');
});
