import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
interface Progress {done:number;total:number;message:string}
const assets=registerPlugin<{status():Promise<{ready:boolean;bytes:number}>;prepare():Promise<void>;addListener(name:'progress',listener:(p:Progress)=>void):Promise<PluginListenerHandle>}>('GameAssets');
/** Blocks application imports until the APK's pinned asset set is complete.
 * No game/store/save modules are initialized by the download screen. */
export async function prepareNativeAssets(){
 if(Capacitor.getPlatform()!=='android')return;
 const status=await assets.status();if(status.ready)return;
 const panel=document.createElement('section');panel.style.cssText='position:fixed;inset:0;z-index:20000;background:#17120d;color:#f4dfae;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:28px;text-align:center;font:18px/1.5 Georgia,serif';
 const title=document.createElement('h1');title.textContent='Your journey awaits';
 const text=document.createElement('p');text.textContent=`Download ${Math.ceil(status.bytes/1048576)} MB of game files to continue. Once finished, you can play offline.`;
 const bar=document.createElement('progress');bar.max=1;bar.value=0;bar.style.width='min(80vw,480px)';
 const button=document.createElement('button');button.textContent='Download game files';button.style.cssText='padding:14px 24px;background:#e2bb70;color:#21180c;border:0;border-radius:8px;font:inherit';
 panel.append(title,text,bar,button);document.body.append(panel);
 let listener:PluginListenerHandle|undefined;
 try{
  await new Promise<void>(resolve=>{button.onclick=()=>{
   button.disabled=true;
   void (async()=>{
    try{
     listener??=await assets.addListener('progress',p=>{bar.value=p.total?Math.min(1,p.done/p.total):0;text.textContent=`${p.message} · ${Math.floor(p.done/1048576)} / ${Math.ceil(p.total/1048576)} MB`;});
     await assets.prepare();resolve();
    }catch(error){text.textContent=error instanceof Error?error.message:'Download interrupted. Reconnect and retry.';button.textContent='Resume download';button.disabled=false;}
   })();
  };});
 }finally{await listener?.remove();panel.remove();}
}
