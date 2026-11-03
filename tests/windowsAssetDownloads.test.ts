import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm,utimes} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {zipSync} from 'fflate';
import {ASSET_BASE_URL,GameAssetStore,validateManifest} from '../desktop/asset-store.cjs';
const digest=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
function fixture(){
 const data=new TextEncoder().encode('approved game asset bytes'),hash=digest(data);
 const pack=zipSync({[hash]:data},{mtime:new Date('2020-01-01T00:00:00Z')});
 const manifest={version:1,baseUrl:ASSET_BASE_URL,files:{'assets/example.txt':{hash,bytes:data.length}},packs:[{hash:digest(pack),bytes:pack.length,files:[hash]}]};
 return {data,hash,pack,manifest};
}
async function temporary(run:(directory:string)=>Promise<void>){const directory=await mkdtemp(join(tmpdir(),'leighneron-assets-'));try{await run(directory);}finally{await rm(directory,{recursive:true,force:true});}}
describe('Windows uses the APK download manifest',()=>{
 it('rejects alternate hosts, unsafe asset names and incomplete pack inventories',()=>{
  const {manifest,hash}=fixture();
  expect(()=>validateManifest({...manifest,baseUrl:'https://example.com/'})).toThrow();
  expect(()=>validateManifest({...manifest,files:{'assets/../save.json':{hash,bytes:1}}})).toThrow();
  expect(()=>validateManifest({...manifest,files:{'assets/evil.js':{hash,bytes:1}}})).toThrow();
  expect(()=>validateManifest({...manifest,packs:[]})).toThrow();
 });
 it('installs verified bytes once, then starts offline and repairs a changed local file',async()=>temporary(async directory=>{
  const {data,hash,pack,manifest}=fixture();let requests=0;
  const fetchPack:typeof fetch=async url=>{expect(String(url)).toBe(ASSET_BASE_URL+manifest.packs[0].hash+'.zip');requests++;return new Response(Uint8Array.from(pack));};
  await new GameAssetStore(validateManifest(manifest),directory,fetchPack).install();
  expect(new Uint8Array(await readFile(join(directory,hash)))).toEqual(data);expect(requests).toBe(1);
  const offline:typeof fetch=async()=>{throw new Error('network unavailable');};
  expect(await new GameAssetStore(validateManifest(manifest),directory,offline).status()).toEqual({ready:true,bytes:0});
  await writeFile(join(directory,hash),new Uint8Array(data.length));
  const later=new Date(Date.now()+60000);await utimes(join(directory,hash),later,later);
  const repair=new GameAssetStore(validateManifest(manifest),directory,fetchPack);
  expect((await repair.status()).ready).toBe(false);await repair.install();
  expect(new Uint8Array(await readFile(join(directory,hash)))).toEqual(data);expect(requests).toBe(2);
 }));
 it('resumes a short transfer at its saved byte offset',async()=>temporary(async directory=>{
  const {data,hash,pack,manifest}=fixture(),cut=23;let requests=0;
  const fetchPack:typeof fetch=async(_url,options)=>{
   requests++;
   if(requests===1)return new Response(Uint8Array.from(pack.subarray(0,cut)));
   expect(new Headers(options?.headers).get('Range')).toBe('bytes='+cut+'-');
   return new Response(Uint8Array.from(pack.subarray(cut)),{status:206,headers:{'Content-Range':`bytes ${cut}-${pack.length-1}/${pack.length}`}});
  };
  await expect(new GameAssetStore(validateManifest(manifest),directory,fetchPack).install()).rejects.toThrow('interrupted');
  await new GameAssetStore(validateManifest(manifest),directory,fetchPack).install();
  expect(new Uint8Array(await readFile(join(directory,hash)))).toEqual(data);expect(requests).toBe(2);
 }));
 it('does not publish bytes from a corrupt pack',async()=>temporary(async directory=>{
  const {hash,pack,manifest}=fixture(),bad=Uint8Array.from(pack);bad[0]^=255;
  const fetchPack:typeof fetch=async()=>new Response(bad);
  await expect(new GameAssetStore(validateManifest(manifest),directory,fetchPack).install()).rejects.toThrow('verification');
  await expect(readFile(join(directory,hash))).rejects.toMatchObject({code:'ENOENT'});
 }));
});
