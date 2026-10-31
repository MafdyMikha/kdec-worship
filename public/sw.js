/* Only a generic offline page is cached. Auth, API responses, calendar data,
   private documents and application HTML are never saved by this worker. */
const CACHE='kdec-offline-v1'
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/offline-retry.js'])))})
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kdec-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url)
  if(url.origin===self.location.origin&&url.pathname==='/offline-retry.js'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline-retry.js')));return}
  if(event.request.mode==='navigate'&&url.origin===self.location.origin){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))
  }
})
