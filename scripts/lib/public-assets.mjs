import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

// Confirmed authoring/retired files only. Never exclude reference/, JSON or
// audio licenses as a class: several are required at runtime or for attribution.
export const AUTHORING_ONLY_ASSETS=new Set([
 'assets/effects/boss-skills-v1.png',
 ...['krag_chieftain','frost_wyrm','rootfather','ashen_seer'].map(folder=>`assets/enemies/${folder}/walk.png`),
 ...['down-v1','side-v1','up-v1','dissolve-v1','bat-v1'].map(file=>`assets/enemies/grand_magus/${file}.png`),
]);
export function authoringOnlyAsset(path){
 return /\.(md|bak)$/i.test(path)||/\.asset-tmp-\d+$/.test(path)||AUTHORING_ONLY_ASSETS.has(path)
  ||/^assets\/characters\/leigneron\/awakened\/[^/]+\/[^/]+-registration-v1\.json$/.test(path);
}
export function imageAlternatives(publicDir){
 const map=JSON.parse(readFileSync(new URL('../../src/data/losslessImagePaths.json',import.meta.url),'utf8'));
 if(!Object.keys(map).length)return {};
 let report;
 try{report=JSON.parse(readFileSync(new URL('../../docs/asset-compression-report.json',import.meta.url),'utf8'));}
 catch{return {};}
 const verified={};const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
 for(const [source,target] of Object.entries(map)){
  if(typeof target!=='string'||!source.startsWith('assets/')||!target.startsWith('assets/')||source.includes('..')||target.includes('..')
   ||!source.endsWith('.png')||!target.endsWith('.webp'))throw Error(`Invalid lossless asset alternative: ${source}`);
  const proof=report.webp?.[source],png=resolve(publicDir,source),webp=resolve(publicDir,target);
  // Authoring tools may regenerate a PNG later. Fall back to that fresh PNG
  // automatically unless BOTH encoded files still match their verified proof.
  // This happens in Node during bundling, never on an Android gameplay frame.
  if(proof?.path===target&&existsSync(png)&&existsSync(webp)
   &&hash(png)===proof.sourceSha256&&hash(webp)===proof.webpSha256)verified[source]=target;
 }return verified;
}
/** Identical inventory for release copying and offline versioning. Exclusions
 * never delete source masters from public/ or affect development serving. */
export function publicAssetFiles(publicDir){
 const alternatives=imageAlternatives(publicDir),targets=new Set(Object.values(alternatives)),files=[];
 const visit=(directory,prefix='')=>{for(const entry of readdirSync(directory,{withFileTypes:true})){
  const relative=prefix+entry.name,path=join(directory,entry.name);
  if(entry.isDirectory())visit(path,relative+'/');
  else if(entry.isFile()&&relative!=='sw.js'&&!authoringOnlyAsset(relative)&&!Object.hasOwn(alternatives,relative)
   &&(!relative.endsWith('.lossless.webp')||targets.has(relative)))files.push(relative);
 }};
 visit(publicDir);return files.sort();
}
