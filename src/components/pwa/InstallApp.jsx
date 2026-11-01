import { useState } from 'react'
import { Download, Smartphone, CheckCircle } from 'lucide-react'
import { usePwa } from './PwaProvider.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { installSteps } from '../../lib/pwa.js'
import { Btn, Card, Modal } from '../ui'

export default function InstallApp({card=false,menu=false}) {
  const pwa=usePwa()
  const {isAr}=useLang()
  const [guide,setGuide]=useState(false)
  if(!pwa)return null
  const label=isAr?'تثبيت التطبيق':'Install app'
  const action=()=>{
    if(pwa.installAvailable&&pwa.secure)void pwa.install()
    else setGuide(true)
  }
  const button=pwa.installed
    ? card?<p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle size={18}/>{isAr?'التطبيق مثبت على هذا الجهاز':'The app is installed on this device.'}</p>:null
    : menu?<button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer" disabled={pwa.installBusy} onClick={action}><Download size={15}/>{pwa.installBusy?(isAr?'جارٍ فتح التثبيت…':'Opening installer…'):label}</button>
    : <Btn variant="secondary" disabled={pwa.installBusy} icon={<Download size={16}/>} onClick={action}>{pwa.installBusy?(isAr?'جارٍ فتح التثبيت…':'Opening installer…'):label}</Btn>
  const content=<>
    {button}
    {!pwa.installed&&(pwa.installError||pwa.installResult==='dismissed'||pwa.installResult==='accepted')&&<div role="status" className="pwa-install-feedback text-sm">
      <p>{pwa.installError?(isAr?'تعذر فتح التثبيت. يمكنك استخدام قائمة المتصفح.':'The installer could not open. You can use your browser’s menu.'):pwa.installResult==='accepted'?(isAr?'أكمل التثبيت في المتصفح، ثم افتح أيقونة KDEC Worship.':'Finish installation in your browser, then open the KDEC Worship icon.'):(isAr?'لم يكتمل التثبيت. يمكنك إضافته لاحقاً من قائمة المتصفح.':'Installation was dismissed. You can install later from your browser’s menu.')}</p>
      <button type="button" className="underline" onClick={()=>setGuide(true)}>{isAr?'عرض خطوات التثبيت':'Show installation steps'}</button>
    </div>}
    {guide&&<Modal open onClose={()=>setGuide(false)} title={isAr?'إضافة KDEC Worship إلى جهازك':'Add KDEC Worship to your device'} footer={<Btn variant="secondary" onClick={()=>setGuide(false)}>{isAr?'تم':'Done'}</Btn>}>
      <div className="space-y-4" dir={isAr?'rtl':'ltr'}>
        <img className="pwa-guide-icon" src="/app-icon-192.png?v=pwa4" width="80" height="80" alt="KDEC Worship"/>
        {!pwa.secure&&<p role="alert" className="text-amber-700">{isAr?'افتح رابط المنصة الآمن HTTPS للتثبيت. معاينة عنوان شبكة محلي HTTP لا تدعم التثبيت.':'Open the deployed HTTPS website to install. An HTTP local-network preview does not support installation.'}</p>}
        <ol className="list-decimal ps-5 space-y-3 text-sm">{installSteps(pwa.platform,isAr).map(step=><li key={step}>{step}</li>)}</ol>
        <p className="text-sm text-slate-500">{isAr?'تحتاج إلى الإنترنت لعرض أحدث جدول وحفظ الردود. قد تحتاج إلى تسجيل الدخول عند أول فتح للتطبيق.':'An internet connection is needed for the current calendar and saved responses. You may need to sign in when you first open the installed app.'}</p>
        <p className="text-sm text-slate-500">{isAr?'إذا ظلت الأيقونة القديمة، احفظ عملك وأضف التطبيق مجدداً من الموقع المحدّث. إزالة التطبيق قد تتطلب تسجيل الدخول مرة أخرى.':'If an older icon remains, save your work and add the app again from the updated website. Removing the installed app may require signing in again.'}</p>
      </div>
    </Modal>}
  </>
  if(!card)return <>{content}</>
  return <Card className="pwa-install-card p-5 space-y-4">
    <div className="flex items-start gap-3"><img src="/app-icon-192.png?v=pwa4" width="56" height="56" className="pwa-guide-icon" alt="KDEC Worship"/><div><h2 className="font-display text-xl font-semibold">{isAr?'KDEC Worship على جهازك':'KDEC Worship on your device'}</h2><p className="text-sm text-slate-500 mt-1">{isAr?'الجدول والترانيم وتكليفاتك، من أيقونة على الشاشة الرئيسية.':'Your calendar, songs and assignments, one Home Screen icon away.'}</p></div><Smartphone size={20} aria-hidden="true" className="hidden sm:block text-slate-400"/></div>
    {content}
    {pwa.workerState==='error'&&<div className="text-sm text-slate-500"><p>{isAr?'تعذر إعداد صفحة المساعدة دون اتصال. المنصة متاحة عند الاتصال.':'Offline help could not be prepared. The app remains available online.'}</p><button type="button" className="underline" onClick={()=>void pwa.retryWorker()}>{isAr?'إعادة المحاولة':'Retry offline setup'}</button></div>}
    {pwa.workerState==='ready'&&<p className="text-xs text-slate-500">{isAr?'صفحة المساعدة دون اتصال جاهزة. بيانات الفريق لا تُخزّن في ذاكرة التطبيق المؤقتة.':'Offline help is ready. Team data is not stored in the app’s offline cache.'}</p>}
  </Card>
}
