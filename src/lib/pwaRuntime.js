import { installPlatform, isStandalone, isTrustedOrigin } from './pwa.js'

// No auth, calendar, notification or member data enters this store.
export function createPwaController(browser,{registerWorker=false}={}) {
  const listeners=new Set()
  let deferredPrompt=null, registration=null, started=false, reloadForUpdate=false, lifecycle=0
  const disposers=[]
  let state={installed:isStandalone(browser),platform:installPlatform(browser?.navigator),secure:isTrustedOrigin(browser),online:browser?.navigator?.onLine!==false,reconnected:false,installAvailable:false,installBusy:false,installResult:'',installError:false,updateAvailable:false,updateBusy:false,updateError:false,workerState:registerWorker?'pending':'development'}
  const emit=patch=>{state={...state,...patch};listeners.forEach(listener=>listener())}
  const listen=(target,type,handler)=>{
    target?.addEventListener?.(type,handler)
    disposers.push(()=>target?.removeEventListener?.(type,handler))
  }
  const checkWaiting=()=>{if(registration?.waiting&&browser.navigator.serviceWorker.controller)emit({updateAvailable:true})}
  const watchRegistration=()=>{
    checkWaiting()
    listen(registration,'updatefound',()=>{
      const worker=registration.installing
      if(!worker)return
      const changed=()=>{
        if(worker.state==='installed'){emit({workerState:'ready'});checkWaiting()}
        if(worker.state==='redundant'&&state.workerState!=='ready')emit({workerState:'error'})
      }
      listen(worker,'statechange',changed);changed()
    })
    // An update may already be installing when register() resolves.
    const worker=registration.installing
    if(worker)listen(worker,'statechange',()=>{if(worker.state==='installed'){emit({workerState:'ready'});checkWaiting()}})
  }
  const register=async()=>{
    if(!registerWorker)return
    if(!state.secure||!browser?.navigator?.serviceWorker){emit({workerState:'unsupported'});return}
    const expectedLifecycle=lifecycle
    emit({workerState:'registering'})
    try{
      const resolved=await browser.navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})
      if(!started||expectedLifecycle!==lifecycle)return
      registration=resolved
      emit({workerState:registration.active?'ready':'registering'})
      watchRegistration()
    }catch{if(started&&expectedLifecycle===lifecycle)emit({workerState:'error'})}
  }
  const start=()=>{
    if(started||!browser)return
    started=true;lifecycle++
    listen(browser,'beforeinstallprompt',event=>{
      event.preventDefault();deferredPrompt=event
      emit({installAvailable:true,installError:false,installResult:''})
    })
    listen(browser,'appinstalled',()=>{
      deferredPrompt=null;emit({installed:true,installAvailable:false,installBusy:false,installError:false,installResult:'installed'})
    })
    for(const mode of ['standalone','fullscreen','minimal-ui','window-controls-overlay']){
      const media=browser.matchMedia?.(`(display-mode: ${mode})`)
      listen(media,'change',()=>{
        if(isStandalone(browser)){deferredPrompt=null;emit({installed:true,installAvailable:false})}
      })
    }
    listen(browser,'offline',()=>emit({online:false,reconnected:false}))
    listen(browser,'online',()=>{if(!state.online)emit({online:true,reconnected:true})})
    listen(browser.navigator.serviceWorker,'controllerchange',()=>{
      emit({workerState:'ready'})
      if(reloadForUpdate){reloadForUpdate=false;browser.location.reload()}
    })
    if(registerWorker){
      if(browser.document.readyState==='complete')void register()
      else listen(browser,'load',()=>{void register()})
    }
    listen(browser.document,'visibilitychange',()=>{
      if(browser.document.visibilityState==='visible'&&registration&&state.online)void registration.update().catch(()=>{})
    })
  }
  const install=async()=>{
    if(state.installed||state.installBusy)return
    const event=deferredPrompt
    if(!event)return
    deferredPrompt=null;emit({installAvailable:false,installBusy:true,installError:false,installResult:''})
    try{
      await event.prompt()
      const choice=await event.userChoice
      // Acceptance is not proof of completed installation; appinstalled owns that state.
      if(!state.installed)emit({installResult:choice?.outcome==='accepted'?'accepted':'dismissed'})
    }catch{emit({installError:true})}
    finally{emit({installBusy:false})}
  }
  const applyUpdate=()=>{
    if(!registration?.waiting||!state.online||state.updateBusy)return
    emit({updateBusy:true,updateError:false})
    reloadForUpdate=true
    try{registration.waiting.postMessage({type:'SKIP_WAITING'})}
    catch{reloadForUpdate=false;emit({updateBusy:false,updateError:true})}
  }
  return {getSnapshot:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},start,install,applyUpdate,
    dismissReconnect:()=>emit({reconnected:false}),retryWorker:register,
    destroy:()=>{started=false;lifecycle++;disposers.splice(0).forEach(dispose=>dispose());listeners.clear()}}
}
