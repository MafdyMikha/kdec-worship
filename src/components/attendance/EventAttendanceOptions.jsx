import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { effectiveTolerance, attendanceError } from '../../lib/attendancePolicy.js'
import { Btn } from '../ui'
import ToleranceEditor from './ToleranceEditor.jsx'

export default function EventAttendanceOptions({event}) {
  const {isAr}=useLang(),navigate=useNavigate()
  const {organizationSettings,updateEventAttendanceOptions}=useStore()
  const [form,setForm]=useState({attendanceEnabled:event.attendanceEnabled!==false,lateToleranceMode:event.lateToleranceMode||'inherit',lateToleranceMinutes:event.lateToleranceMinutes||0})
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  const save=async()=>{
    setBusy(true);setError('');setSaved(false)
    try{const result=await updateEventAttendanceOptions(event.id,form);if(result.error)setError(attendanceError(result.error,isAr));else setSaved(true)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <details className="rounded-xl border border-slate-200 p-4"><summary className="font-semibold cursor-pointer">{isAr?'حضور هذه الفعالية وسماح التأخير':'Event attendance and late tolerance'}</summary><div className="mt-4 space-y-3">
    <label className="flex items-center gap-2"><input type="checkbox" checked={form.attendanceEnabled} onChange={e=>{setSaved(false);setForm(v=>({...v,attendanceEnabled:e.target.checked}))}}/>{isAr?'تفعيل تسجيل الحضور لهذه الفعالية':'Enable attendance for this event'}</label>
    <ToleranceEditor value={form} inheritedMinutes={effectiveTolerance({},organizationSettings)} disabled={busy} onChange={fields=>{setSaved(false);setForm(v=>({...v,...fields}))}}/>
    <p className="text-xs text-slate-500">{isAr?'يمكن إلغاء السماح لهذه الفعالية وحدها. الوصول بعد الموعد مباشرة يُسجّل متأخرًا. سجلات الحضور السابقة لا تتغير.':'You can remove tolerance for this event alone. Arrival after the start is then late. Existing attendance records keep their original rules.'}</p>
    <div className="flex flex-wrap gap-2"><Btn disabled={busy} onClick={()=>void save()}>{isAr?'حفظ إعدادات الحضور':'Save attendance settings'}</Btn><Btn variant="secondary" disabled={!event.publishedAt||!event.attendanceEnabled} onClick={()=>navigate(`/attendance?event=${encodeURIComponent(event.id)}`)}>{isAr?'إنشاء جلسة ورمز حضور':'Create attendance session & QR'}</Btn></div>
    {error&&<p role="alert" className="text-red-600">{error}</p>}{saved&&<p role="status" className="text-emerald-700">{isAr?'تم حفظ إعدادات هذه الفعالية':'Event attendance settings saved'}</p>}
  </div></details>
}
