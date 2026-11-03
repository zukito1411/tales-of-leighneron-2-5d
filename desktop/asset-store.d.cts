export interface Pack {hash:string;bytes:number;files:string[]}
export interface Manifest {files:Map<string,{hash:string;bytes:number}>;expected:Map<string,number>;packs:Pack[]}
export interface Progress {done:number;total:number;message:string;stage:'check'|'download'}
export const ASSET_BASE_URL:string;
export function validateManifest(value:unknown):Manifest;
export function loadManifest(filename:string):Manifest|null;
export class GameAssetStore {
 constructor(manifest:Manifest,directory:string,fetchImpl?:typeof fetch);
 status(progress?:(value:Progress)=>void,signal?:AbortSignal):Promise<{ready:boolean;bytes:number}>;
 install(progress?:(value:Progress)=>void,signal?:AbortSignal):Promise<void>;
}
