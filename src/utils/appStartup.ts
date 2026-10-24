import {Capacitor} from '@capacitor/core';

const OFFLINE_PREFIX='mernondna-25d-shell-';
const REGISTRATION_TIMEOUT_MS=2500;

// A stalled service-worker database must not hold the game at its splash screen.
async function scopedRegistrations():Promise<ReadonlyArray<ServiceWorkerRegistration>>{
  if(!('serviceWorker' in navigator))return [];
  return Promise.race([
    navigator.serviceWorker.getRegistrations(),
    new Promise<ReadonlyArray<ServiceWorkerRegistration>>(resolve=>setTimeout(()=>resolve([]),REGISTRATION_TIMEOUT_MS)),
  ]);
}

async function unregisterScopedWorkers(scope:string):Promise<boolean>{
  const registrations=(await scopedRegistrations()).filter(reg=>reg.scope===scope);
  if(!registrations.length)return false;
  return Promise.race([
    Promise.all(registrations.map(reg=>reg.unregister())).then(results=>results.some(Boolean)),
    new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),REGISTRATION_TIMEOUT_MS)),
  ]);
}

export async function prepareOfflineStartup():Promise<boolean> {
  // Desktop assets are bundled under a secure and stable native protocol.
  // Never install an internet-style PWA cache over the local game files.
  if(location.protocol==='leighneron:')return true;
  if(!('serviceWorker' in navigator))return true;
  const scope=new URL(import.meta.env.BASE_URL,location.href).href;
  if(Capacitor.isNativePlatform()){
    // Native APKs bundle their assets. Remove leftover PWA workers without
    // touching localStorage, which holds the player's save and settings.
    const unregistered=await unregisterScopedWorkers(scope);
    // Existing pages remain controlled until navigation after unregister.
    if(unregistered&&navigator.serviceWorker.controller){location.reload();return false;}
    return true;
  }
  if(!import.meta.env.PROD)return true;
  if(typeof navigator.storage?.persist==='function'){
    void navigator.storage.persist().then(persisted=>{
      if(!persisted)console.info('Persistent offline storage was not granted; the browser may clear cached game assets when storage is low.');
    }).catch(error=>console.warn('Persistent offline storage request failed:',error));
  }
  void navigator.serviceWorker.register(new URL('sw.js',scope),{scope,updateViaCache:'none'})
    .catch(error=>console.warn('Offline app registration failed:',error));
  return true;
}

// Cache repair preserves localStorage, saves, and all other app data.
export async function refreshOfflineGameFiles():Promise<void>{
  try {
    const scope=new URL(import.meta.env.BASE_URL,location.href).href;
    await unregisterScopedWorkers(scope);
    if('caches' in window){
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith(OFFLINE_PREFIX)).map(key=>caches.delete(key)));
    }
  }catch(error){console.warn('Could not clear game asset cache:',error);}
  location.reload();
}
