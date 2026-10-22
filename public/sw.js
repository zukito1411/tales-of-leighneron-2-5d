const PREFIX = 'mernondna-25d-shell-v3-';
const root = new URL('./', self.registration.scope).href;
const manifestUrl = new URL('offline-shell.json', root).href;
let installed;
async function manifest() {
  if (installed) return installed;
  const cached = await (await caches.open(PREFIX+BUILD_VERSION)).match(manifestUrl);
  if (!cached) throw new Error('Offline shell has not been installed.');
  return cached.json();
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(manifestUrl, {cache:'no-store'});
    if (!response.ok) throw new Error('Offline build manifest is unavailable.');
    const data = await response.json();
    if (data.version!==BUILD_VERSION || !Array.isArray(data.files)) throw new Error('Invalid offline build manifest.');
    installed = data;
    const cache=await caches.open(PREFIX+data.version);
    // Cache only the app shell at install. Caching 400+ MB of artwork and audio
    // during installation can exhaust mobile storage; game assets are cached
    // on demand as they are requested.
    const shell=data.files.filter(path=>path==='./'||path==='index.html'||/\.(js|css)$/.test(path));
    const requests=shell.map(path => new Request(new URL(path,root), {cache:'reload'}));
    for(let offset=0;offset<requests.length;offset+=8)
      await cache.addAll(requests.slice(offset,offset+8));
    await cache.put(manifestUrl,new Response(JSON.stringify(data)));
    // Updates wait for old clients to close instead of mixing active module graphs.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const data = installed || await manifest();
    const shells = (await caches.keys()).filter(key => key.startsWith('mernondna-25d-shell-'));
    for (const key of shells) if(key!==PREFIX+data.version) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request,url = new URL(request.url);
  if (request.method!=='GET' || url.origin!==self.location.origin || !url.href.startsWith(root)) return;
  event.respondWith((async () => {
    // Broken cache metadata must not prevent normal network fetching.
    let data;
    try {data=await manifest();} catch {return fetch(request);}
    let cache;
    try {cache=await caches.open(PREFIX+data.version);} catch {return fetch(request);}
    if(request.mode==='navigate') {
      const shell = await cache.match(root,{ignoreVary:true}) || await cache.match(new URL('index.html',root),{ignoreVary:true});
      if(shell)return shell;
    }
    const hit=await cache.match(request,{ignoreVary:true});if(hit)return hit;
    try {
      const response=await fetch(request);
      if(response.ok && response.type==='basic')try{await cache.put(request,response.clone());}catch{/* Storage pressure must not break a live load. */}
      return response;
    } catch(error) {
      if(/\/[\w-]+-[\w-]+\.(js|css)$/.test(url.pathname))for(const key of await caches.keys())
        if(key.startsWith(PREFIX)){const older=await (await caches.open(key)).match(request,{ignoreVary:true});if(older)return older;}
      throw error;
    }
  })());
});
