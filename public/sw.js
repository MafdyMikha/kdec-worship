/* Public offline help only. Never cache app HTML, bundles, auth callbacks,
   Supabase requests, calendar data, notifications or private documents. */
const CACHE='kdec-offline-v3'
const PUBLIC_ASSETS=['/offline.html','/offline-retry.js','/offline.css','/brand/option-b-lockup.png']
self.addEventListener('install',event=>{
  // Let the user choose when to activate an update; never force a form reload.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS.map(path=>new Request(path,{cache:'reload',credentials:'omit'})))))
})
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kdec-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
})
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting())
})
self.addEventListener('fetch',event=>{
  const request=event.request
  const url=new URL(request.url)
  if(request.method!=='GET'||url.origin!==self.location.origin)return
  if(PUBLIC_ASSETS.includes(url.pathname)&&!url.search){
    event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match(url.pathname))))
    return
  }
  // API and framework assets never receive an HTML offline response.
  if(request.mode==='navigate'&&!/^\/(api|auth|rest|storage|functions|assets)(\/|$)/.test(url.pathname)){
    event.respondWith(fetch(request).catch(async()=>await caches.open(CACHE).then(cache=>cache.match('/offline.html'))||new Response('KDEC Worship is offline. Reconnect and reload.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})))
  }
})
