import { useState } from 'react'
import { Layers } from 'lucide-react'
import { useLang } from '../../lib/i18n.jsx'
import { Card } from '../ui'

export default function AppearanceSettings() {
  const {isAr}=useLang()
  const [reduced,setReduced]=useState(()=>document.documentElement.dataset.reduceTransparency==='true')
  const [error,setError]=useState(false)
  const change=value=>{
    document.documentElement.dataset.reduceTransparency=String(value)
    setReduced(value);setError(false)
    try{localStorage.setItem('kdec_reduce_transparency',String(value))}catch{setError(true)}
  }
  return <Card className="p-5 space-y-3">
    <h2 className="flex items-center gap-2 text-xl font-display font-semibold"><Layers size={19} aria-hidden="true"/>{isAr?'المظهر وسهولة القراءة':'Appearance & readability'}</h2>
    <label className="flex items-center gap-3 cursor-pointer min-h-11"><input type="checkbox" checked={reduced} onChange={event=>change(event.target.checked)}/><span className="font-medium text-sm">{isAr?'تقليل الشفافية':'Reduce transparency'}</span></label>
    <p className="text-sm text-slate-500">{isAr?'استخدم خلفيات صلبة لأشرطة التنقل. إعدادات الجهاز لتقليل الحركة وزيادة التباين مدعومة أيضاً.':'Use solid navigation surfaces. Your device’s reduced-motion and increased-contrast preferences are also respected.'}</p>
    {error&&<p role="status" className="text-sm text-amber-700">{isAr?'تم تطبيق الاختيار لهذه الجلسة، لكن تعذر حفظه على الجهاز.':'Applied for this session, but the preference could not be saved on this device.'}</p>}
  </Card>
}
