import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore.jsx'
import { EVENT_TYPES } from '../../lib/planningCalendar.js'
import { useLang } from '../../lib/i18n.jsx'
import { Badge, Btn, Card, Input, Select } from '../ui'
import { formatAttendanceTime, formatAttendanceTimestamp } from '../../lib/attendanceReport.js'

export default function MemberAttendanceHistory({person}) {
  const {isAr}=useLang(),{loadMemberAttendanceHistory}=useStore()
  const [filters,setFilters]=useState({from:'',to:'',kind:'',status:'',offset:0})
  const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true
    const load=async()=>{
      setBusy(true);setError('')
      try{const response=await loadMemberAttendanceHistory(person.id,filters);if(!active)return;if(response.error){setError(response.error);setResult(null)}else setResult(response.data)}
      catch(e){if(active)setError(e.message)}finally{if(active)setBusy(false)}
    }
    void load();return()=>{active=false}
  },[person.id,filters,loadMemberAttendanceHistory,retry])
  const set=(key,value)=>setFilters(previous=>({...previous,[key]:value,offset:0}))
  const typeLabel=value=>{const type=EVENT_TYPES.find(t=>t.key===value);return type?(isAr?type.ar:type.en):value}
  const statusLabels={present:isAr?'حاضر':'Present',late:isAr?'متأخر':'Late',absent:isAr?'غائب مسجل':'Recorded absent',excused:isAr?'بعذر':'Excused'}
  return <section className="space-y-4" aria-busy={busy}>
    <p className="text-sm text-slate-500">{isAr?'سجل الخدمات والاجتماعات والفعاليات. عدم وجود سجل لا يعني الغياب.':'Services, meetings and events. A missing record does not imply absence.'}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input label={isAr?'من تاريخ':'From date'} type="date" value={filters.from} onChange={e=>set('from',e.target.value)}/><Input label={isAr?'إلى تاريخ':'To date'} type="date" min={filters.from} value={filters.to} onChange={e=>set('to',e.target.value)}/>
      <Select label={isAr?'نوع الفعالية':'Event type'} value={filters.kind} onChange={e=>set('kind',e.target.value)}><option value="">{isAr?'كل الأنواع':'All types'}</option>{(result?.types||[]).map(type=><option key={type} value={type}>{typeLabel(type)}</option>)}</Select>
      <Select label={isAr?'حالة الحضور':'Attendance status'} value={filters.status} onChange={e=>set('status',e.target.value)}><option value="">{isAr?'كل الحالات':'All statuses'}</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
    </div>
    {error&&<div role="alert" className="text-red-600">{error} <Btn variant="secondary" onClick={()=>setRetry(v=>v+1)}>{isAr?'إعادة المحاولة':'Retry'}</Btn></div>}
    {result&&<><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[['present',isAr?'حضور مسجل':'Recorded attendance'],['late',isAr?'متأخر':'Late'],['absent',isAr?'غائب مسجل':'Recorded absent'],['excused',isAr?'بعذر':'Excused']].map(([key,label])=><div key={key} className="rounded-xl bg-slate-50 p-3 text-center"><strong className="text-xl">{result.summary?.[key]||0}</strong><div className="text-xs text-slate-500">{label}</div></div>)}</div>
    {!result.rows.length&&!busy&&<p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">{isAr?'لا يوجد سجل حضور مطابق لهذه الفلاتر.':'No attendance history matches these filters.'}</p>}
    {result.rows.map(row=><Card key={row.id} className="p-4 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold" dir="auto">{row.sessionName}</h3><Badge color={row.status==='late'?'red':'slate'}>{statusLabels[row.status]||row.status}</Badge></div><p className="text-xs text-slate-500">{typeLabel(row.sessionType)} · <bdi>{row.date} · {formatAttendanceTime(row.startTime,isAr)} – {formatAttendanceTime(row.endTime,isAr)}</bdi></p><p className="text-sm">{isAr?'الدخول':'Check in'}: <bdi>{formatAttendanceTimestamp(row.checkInAt,'Africa/Cairo',isAr)}</bdi></p><p className="text-sm">{isAr?'الخروج':'Check out'}: <bdi>{formatAttendanceTimestamp(row.checkOutAt,'Africa/Cairo',isAr)}</bdi></p>{row.status==='late'&&<p className="text-sm text-red-600">{isAr?'دقائق بعد موعد البداية':'Minutes after scheduled start'}: {row.lateByMinutes}</p>}</Card>)}
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><Btn variant="secondary" disabled={busy||!filters.offset} onClick={()=>setFilters(v=>({...v,offset:Math.max(0,v.offset-50)}))}>{isAr?'السابق':'Previous'}</Btn><span>{result.total?filters.offset+1:0}–{Math.min(filters.offset+50,result.total)} / {result.total}</span><Btn variant="secondary" disabled={busy||filters.offset+50>=result.total} onClick={()=>setFilters(v=>({...v,offset:v.offset+50}))}>{isAr?'التالي':'Next'}</Btn></div></>}
    {busy&&<p role="status">{isAr?'جارٍ تحميل السجل…':'Loading attendance history…'}</p>}
  </section>
}
