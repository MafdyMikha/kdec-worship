/* Only the generic offline page, retry script and public logo are cached. Auth, API responses, calendar data,
   private documents and application HTML are never saved by this worker. */
const CACHE='kdec-offline-v2'
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/offline-retry.js','/brand/option-b-lockup.png'])))})
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kdec-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url)
  if(url.origin===self.location.origin&&['/offline-retry.js','/brand/option-b-lockup.png'].includes(url.pathname)){event.respondWith(fetch(event.request).catch(()=>caches.match(url.pathname)));return}
  if(event.request.mode==='navigate'&&url.origin===self.location.origin){
    event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))
  }
})
