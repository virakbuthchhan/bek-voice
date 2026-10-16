const CACHE='sori-shell-v4';
const SHELL=['./','index.html','style.css','app.js','browser-engine.js','voice-recorder.js','browser-engine.worker.js','model-manifest.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sori-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 const known=event.request.mode==='navigate'||/\.(html|css|js|mjs|wasm|ttf|json)$/.test(url.pathname);
 if(!known)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}
  catch(error){const saved=await cache.match(event.request);if(saved)return saved;if(event.request.mode==='navigate'){const shell=await cache.match('./');if(shell)return shell;}throw error;}
 })());
});
