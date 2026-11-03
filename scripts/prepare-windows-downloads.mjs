import {createRequire} from 'node:module';
import {cpSync,copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {publicAssetFiles} from './lib/public-assets.mjs';

const require=createRequire(import.meta.url);
const {validateManifest}=require('../desktop/asset-store.cjs');
const supplied=process.argv[2];
if(!supplied)throw new Error('Pass the Android job’s pinned native-assets.json. Windows must not generate a different pack set.');
const manifestFile=resolve(supplied),raw=readFileSync(manifestFile),manifest=validateManifest(JSON.parse(raw.toString('utf8')));
// This uses the identical shipping inventory. Text line endings can differ on
// Windows checkout; the downloader supplies Android's exact verified bytes.
const shipping=publicAssetFiles('public').filter(p=>p.startsWith('assets/')&&p!=='assets/reference/game-load.png'&&!/\.(?:js|mjs|cjs|css|html|wasm)$/i.test(p));
if(shipping.length!==manifest.files.size||shipping.some(p=>!manifest.files.has(p)))throw new Error('Windows content does not match the Android download inventory from this build.');
const dist=resolve('dist');
for(const name of shipping){const file=resolve(dist,name);if(!existsSync(file))throw new Error('Missing shipping asset before shell preparation: '+name);}
for(const name of shipping)rmSync(resolve(dist,name));
writeFileSync(join(dist,'native-assets.json'),raw);
const stage=resolve('desktop-package');
rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});cpSync(dist,join(stage,'dist'),{recursive:true});
for(const name of ['main.cjs','preload.cjs','asset-store.cjs','asset-worker.cjs']){
 mkdirSync(join(stage,'desktop'),{recursive:true});copyFileSync(resolve('desktop',name),join(stage,'desktop',name));
}
// Stage only the tiny native launcher dependency, not Phaser/Three/React's
// source node_modules: those libraries already live in the Vite application.
const fflatePackage=require.resolve('fflate/package.json'),fflateRoot=dirname(fflatePackage);
const fflate=JSON.parse(readFileSync(fflatePackage,'utf8'));
if(fflate.version!=='0.8.3')throw new Error('Unexpected desktop ZIP decoder version.');
mkdirSync(join(stage,'desktop/vendor'),{recursive:true});
copyFileSync(join(fflateRoot,'lib/node.cjs'),join(stage,'desktop/vendor/fflate.cjs'));
copyFileSync(join(fflateRoot,'LICENSE'),join(stage,'desktop/vendor/LICENSE.fflate'));
const sourcePackage=JSON.parse(readFileSync('package.json','utf8'));
writeFileSync(join(stage,'package.json'),JSON.stringify({name:sourcePackage.name,version:sourcePackage.version,
 description:sourcePackage.description,main:'desktop/main.cjs',private:true,dependencies:{}},null,2));
let bytes=0;
function count(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){const file=join(directory,entry.name);if(entry.isDirectory())count(file);else if(entry.isFile())bytes+=statSync(file).size;}}
count(stage);
if(bytes>64*1024*1024)throw new Error('The desktop shell still exceeds 64 MiB. Refusing to package a large asset payload.');
console.log(`Windows shell: ${bytes} bytes before Electron; ${manifest.files.size} asset paths use the exact Android manifest and immutable packs.`);
