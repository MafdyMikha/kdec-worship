import { useState } from 'react'
import { Wifi, WifiOff, RefreshCw, X } from 'lucide-react'
import { usePwa } from './PwaProvider.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { isAdminUser } from '../../lib/permissions.js'
import { useStore } from '../../store/useStore.jsx'

export default function PwaStatus() {
  const pwa=usePwa()
  const {isAr}=useLang()
  const {loadAll,currentUser,isDemoMode}=useStore()
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  if(!pwa)return null
  const refresh=async()=>{
    setBusy(true);setError('')
    try{const result=await loadAll(isAdminUser(currentUser));if(result?.error)setError(result.error);else pwa.dismissReconnect()}
    catch{setError(isAr?'تعذر تحديث البيانات. حاول مرة أخرى.':'Data could not be refreshed. Please try again.')}
    finally{setBusy(false)}
  }
  return <div className="pwa-status-stack" dir={isAr?'rtl':'ltr'}>
    {!pwa.online&&<div className="pwa-notice" role="status"><WifiOff size={17} aria-hidden="true"/><p>{isAr?'أنت غير متصل. اتصل بالإنترنت قبل حفظ التغييرات أو الرد على التكليفات.':'You’re offline. Reconnect before saving changes or responding to assignments.'}</p></div>}
    {pwa.online&&pwa.reconnected&&<div className="pwa-notice" role="status"><Wifi size={17} aria-hidden="true"/><p>{isAr?'عاد الاتصال. يمكنك تحديث البيانات عندما تكون مستعداً؛ لن يتم إعادة تحميل النموذج تلقائياً.':'You’re back online. Refresh data when ready; your form has not been reloaded.'}</p>{currentUser&&!isDemoMode&&<button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?(isAr?'جارٍ التحديث…':'Refreshing…'):(isAr?'تحديث البيانات':'Refresh data')}</button>}<button type="button" aria-label={isAr?'إغلاق':'Dismiss'} onClick={pwa.dismissReconnect}><X size={16}/></button>{error&&<p role="alert">{error}</p>}</div>}
    {pwa.updateAvailable&&<div className="pwa-notice" role="status"><RefreshCw size={17} aria-hidden="true"/><p>{isAr?'تحديث جاهز. احفظ عملك أولاً، ثم أعد تحميل التطبيق.':'An update is ready. Save your work, then reload the app.'}</p><button type="button" disabled={!pwa.online||pwa.updateBusy} onClick={pwa.applyUpdate}>{pwa.updateBusy?(isAr?'جارٍ التحديث…':'Updating…'):(isAr?'تحديث وإعادة تحميل':'Update & reload')}</button>{pwa.updateError&&<p role="alert">{isAr?'تعذر تفعيل التحديث. أعد المحاولة.':'The update could not activate. Please retry.'}</p>}</div>}
  </div>
}
