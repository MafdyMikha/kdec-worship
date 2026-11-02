/* Public offline help only. Never cache app HTML, bundles, auth callbacks,
   Supabase requests, calendar data, notifications or private documents. */
const CACHE='kdec-offline-v4'
const PUBLIC_ASSETS=['/offline.html','/offline-retry.js','/offline.css','/brand/kdec-clean-symbols.svg']
self.addEventListener('install',event=>{
  // Let the user choose when to activate an update; never force a form reload.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS.map(path=>new Request(path,{cache:'reload',credentials:'omit'})))))
})
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('kdec-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
})
self.addEventListener('message',event=>{
  if(event.data?.type==='PUSH_VERSION')event.ports?.[0]?.postMessage({type:'PUSH_READY',version:1})
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

// Only an opaque device/account binding is persisted, never payloads or auth
// tokens. Clearing this binding on logout suppresses queued former-account pushes.
function readPushBinding(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('kdec-push-device',1)
    request.onupgradeneeded=()=>request.result.createObjectStore('device')
    request.onerror=()=>reject(new Error('Push device storage unavailable'))
    request.onsuccess=()=>{
      const db=request.result
      const tx=db.transaction('device','readonly')
      const op=tx.objectStore('device').get('binding')
      op.onsuccess=()=>{db.close();resolve(op.result?.token||null)}
      op.onerror=()=>{db.close();reject(new Error('Push device storage unavailable'))}
    }
  })
}
function pushPath(value){
  return typeof value==='string'&&(/^\/services\/[0-9a-f-]{36}$/i.test(value)||['/settings','/schedule','/announcements'].includes(value))?value:'/'
}
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let payload
    try{payload=event.data?.json()}catch{return}
    if(!payload||typeof payload.binding!=='string'||!payload.binding||payload.binding!==await readPushBinding())return
    // Fixed title and bounded generic body. No external icons, actions or URLs.
    await self.registration.showNotification('KDEC Worship',{
      body:typeof payload.body==='string'?payload.body.slice(0,240):(payload.lang==='ar'?'افتح KDEC Worship للاطلاع على التحديث.':'Open KDEC Worship for an update.'),
      icon:'/icons/kdec-worship-v5-192.png',badge:'/icons/kdec-worship-v5-192.png',
      lang:payload.lang==='ar'?'ar':'en',dir:payload.lang==='ar'?'rtl':'ltr',
      tag:typeof payload.tag==='string'?payload.tag.slice(0,100):'kdec-update',
      data:{url:pushPath(payload.url),binding:payload.binding},
    })
  })().catch(()=>{}))
})
self.addEventListener('notificationclick',event=>{
  event.notification.close()
  event.waitUntil((async()=>{
    if(event.notification.data?.binding!==await readPushBinding())return
    const target=new URL(pushPath(event.notification.data?.url),self.location.origin).href
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true})
    const existing=windows.find(client=>new URL(client.url).origin===self.location.origin)
    if(existing){await existing.navigate(target);await existing.focus()}
    else await self.clients.openWindow(target)
  })().catch(()=>{}))
})
