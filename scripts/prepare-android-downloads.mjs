import {publicAssetFiles} from './lib/public-assets.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const paths=publicAssetFiles('public').filter(p=>p.startsWith('assets/')&&p!=='assets/reference/game-load.png'&&!/\.(?:js|mjs|cjs|css|html|wasm)$/i.test(p));
mkdirSync('asset-packs',{recursive:true});
writeFileSync('asset-packs/inventory.json',JSON.stringify(paths));
execFileSync('python3',['scripts/pack-android-assets.py'],{stdio:'inherit'});
