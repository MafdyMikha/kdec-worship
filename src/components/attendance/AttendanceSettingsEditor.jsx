import { useState } from 'react'
import { useLang } from '../../lib/i18n.jsx'
import { Btn, Input, Modal, Select } from '../ui'
import ToleranceEditor from './ToleranceEditor.jsx'
import { attendanceError, validTolerance } from '../../lib/attendancePolicy.js'

function SettingsForm({ settings, onSave, onClose }) {
  const { isAr }=useLang()
  const [form,setForm]=useState({lateToleranceMode:settings.attendanceLateEnabled===false?'none':'custom',lateToleranceMinutes:settings.attendanceLateMinutes,excuseLimit:settings.excuseLimit,excusePeriod:settings.excusePeriod})
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const save=async()=>{
    if(!validTolerance(form.lateToleranceMinutes)){setError(attendanceError('Enter a non-negative whole number of minutes.',isAr));return}
    setBusy(true);setError('')
    try{const result=await onSave({attendanceLateEnabled:form.lateToleranceMode!=='none',attendanceLateMinutes:Number(form.lateToleranceMinutes),excuseLimit:Number(form.excuseLimit),excusePeriod:form.excusePeriod});if(result?.error)setError(result.error);else onClose()}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="space-y-4"><ToleranceEditor value={form} allowInherit={false} disabled={busy} onChange={fields=>setForm(v=>({...v,...fields}))}/>
    <Input label={isAr?'حد الأعذار':'Excuse limit'} type="number" min="0" max="100" step="1" value={form.excuseLimit} onChange={e=>setForm(v=>({...v,excuseLimit:e.target.value}))}/>
    <Select label={isAr?'فترة الأعذار':'Excuse period'} value={form.excusePeriod} onChange={e=>setForm(v=>({...v,excusePeriod:e.target.value}))}>{[['monthly','Monthly','شهريًا'],['weekly','Weekly','أسبوعيًا'],['total','Total','الإجمالي']].map(([v,en,ar])=><option key={v} value={v}>{isAr?ar:en}</option>)}</Select>
    <p className="text-xs text-slate-500">{isAr?'القيمة الافتراضية للجلسات الجديدة فقط. سجلات الحضور السابقة تحتفظ بقواعدها.':'This default applies to new sessions. Existing attendance records retain their original rules.'}</p>
    {error&&<p role="alert" className="text-red-600">{error}</p>}<Btn disabled={busy} onClick={save}>{busy?(isAr?'جارٍ الحفظ…':'Saving…'):(isAr?'حفظ الإعدادات':'Save settings')}</Btn>
  </div>
}
export default function AttendanceSettingsEditor({settings,onSave}) {
  const {isAr}=useLang();const [open,setOpen]=useState(false)
  return <><Btn variant="secondary" onClick={()=>setOpen(true)}>{isAr?'إعدادات الحضور':'Attendance settings'} · {settings.attendanceLateEnabled===false?0:settings.attendanceLateMinutes} {isAr?'د':'min'}</Btn><Modal open={open} onClose={()=>setOpen(false)} title={isAr?'إعدادات الحضور':'Attendance settings'}><SettingsForm settings={settings} onSave={onSave} onClose={()=>setOpen(false)}/></Modal></>
}
