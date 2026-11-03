export interface DesktopAssetProgress {done:number;total:number;message:string;stage:'check'|'download'}
export interface DesktopAssetBridge {
 status():Promise<{ready:boolean;bytes:number}>;
 prepare():Promise<void>;
 onProgress(listener:(progress:DesktopAssetProgress)=>void):()=>void;
}
declare global {interface Window {leighneronDesktopAssets?:DesktopAssetBridge}}

/** Windows pins Android's manifest. No game/store/save import runs until its
 * local verified asset set is complete; progress/retries do not start Phaser. */
export async function prepareDesktopAssets(assets:DesktopAssetBridge){
 const panel=document.createElement('section');
 panel.style.cssText='position:fixed;inset:0;z-index:20000;background:#17120d;color:#f4dfae;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:28px;text-align:center;font:18px/1.5 Georgia,serif';
 const title=document.createElement('h1');title.textContent='Your journey awaits';
 const text=document.createElement('p');text.textContent='Checking installed game files…';text.setAttribute('role','status');
 const bar=document.createElement('progress');bar.max=1;bar.removeAttribute('value');bar.style.width='min(80vw,480px)';bar.setAttribute('aria-label','Preparing game files');
 const button=document.createElement('button');button.type='button';button.hidden=true;
 button.style.cssText='padding:14px 24px;background:#e2bb70;color:#21180c;border:0;border-radius:8px;font:inherit';
 const note=document.createElement('small');note.textContent='Completed downloads are kept. Once ready, you can play offline. Your save stays on this PC.';
 panel.append(title,text,bar,button,note);document.body.append(panel);
 const removeProgress=assets.onProgress(progress=>{
  if(progress.stage==='check'){bar.removeAttribute('value');text.textContent=progress.message;}
  else {bar.value=progress.total?Math.min(1,progress.done/progress.total):0;
   text.textContent=`${progress.message} · ${Math.floor(progress.done/1048576)} / ${Math.ceil(progress.total/1048576)} MB`;}
 });
 const waitForClick=(label:string)=>new Promise<void>(resolve=>{button.textContent=label;button.disabled=false;button.hidden=false;button.onclick=()=>{button.onclick=null;button.disabled=true;resolve();};});
 let approved=false;
 try{
  while(true){
   let status:{ready:boolean;bytes:number};
   try{status=await assets.status();}
   catch(error){text.textContent=error instanceof Error?error.message:'Could not check game files.';await waitForClick('Retry checking files');continue;}
   if(status.ready)return;
   bar.value=0;text.textContent=`Download ${Math.ceil(status.bytes/1048576)} MB of game files to continue.`;
   if(!approved)await waitForClick('Download game files');approved=true;
   try{await assets.prepare();return;}
   catch(error){text.textContent=error instanceof Error?error.message:'Download interrupted. Reconnect and retry.';await waitForClick('Resume download');}
  }
 }finally{button.onclick=null;removeProgress();panel.remove();}
}
