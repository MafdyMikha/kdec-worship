import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { ar } from 'date-fns/locale'
import { CalendarDays, Download, List, Plus } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { hasPermission } from '../lib/permissions.js'
import { quarterBounds, scheduleLabels } from '../lib/quarterlySchedule.js'
import { calendarEntries, cairoToday, entryOnDay, EVENT_TYPES, eventStage, eventType, memberAssignmentStatus, planningMessage, publicationIssues } from '../lib/planningCalendar.js'
import { formatClock } from '../lib/time.js'
import { rehearsalLocationUrl } from '../lib/rehearsal.js'
import { exportQuarterPDF } from '../lib/schedulePdf.js'
import { Badge, Card, Btn, Select, Modal } from './ui'
import PlanningEventForm from './PlanningEventForm'
import EventAttendanceOptions from './attendance/EventAttendanceOptions.jsx'
import ScheduleAssignments from './ScheduleAssignments'

export default function QuarterlySchedule() {
  const {services,people,currentUser,quarterly,scheduleAction,loadAll,isDemoMode,loading,planningReady,worshipRoles,updateService}=useStore()
  const {isAr}=useLang()
  const navigate=useNavigate()
  const [params,setParams]=useSearchParams()
  const today=cairoToday()
  const requestedYear=Number(params.get('year'))
  const year=Number.isInteger(requestedYear)&&requestedYear>=2000&&requestedYear<=2200?requestedYear:Number(today.slice(0,4))
  const quarter=[1,2,3,4].includes(Number(params.get('quarter')))?Number(params.get('quarter')):Math.ceil(Number(today.slice(5,7))/3)
  const [view,setView]=useState('calendar')
  const [mine,setMine]=useState(false)
  const [showCancelled,setShowCancelled]=useState(true)
  const [kind,setKind]=useState('all')
  const [form,setForm]=useState(null)
  const [detailId,setDetailId]=useState(null)
  const [review,setReview]=useState(false)
  const [cancel,setCancel]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const manager=hasPermission(currentUser,'schedules.manage')
  const canCreate=manager||hasPermission(currentUser,'services.create')
  const canEdit=manager||hasPermission(currentUser,'services.edit')
  const viewDrafts=canEdit||canCreate
  const labels=scheduleLabels[isAr?'ar':'en']
  const bounds=quarterBounds(year,quarter)
  const list=services.filter(event=>!event.archivedAt&&event.date>=bounds.start&&event.date<bounds.end&&(viewDrafts||eventStage(event)!=='draft'))
  const entries=calendarEntries(services,bounds.start,bounds.end,{mine,userId:currentUser?.id,manager:viewDrafts,cancelled:showCancelled}).filter(event=>kind==='all'||eventType(event).key===kind)
  const drafts=list.filter(event=>eventStage(event)==='draft'&&event.date>=today)
  const issues=drafts.flatMap(event=>publicationIssues(event,worshipRoles).map(issue=>`${event.title}: ${issue}`))
  const exportIds=new Set(calendarEntries(services,bounds.start,bounds.end,{manager:viewDrafts}).map(entry=>entry.parentId))
  const detail=services.find(event=>event.id===detailId)
  const choose=(key,value)=>setParams(previous=>{const next=new URLSearchParams(previous);next.set(key,value);return next})
  const openDate=date=>{setError('');setSuccess('');setForm({date})}
  const run=async action=>{
    if(busy)return
    setBusy(true);setError('');setSuccess('')
    try{const result=await action();if(result?.error)setError(result.error);else{setSuccess(isAr?'تم الحفظ بنجاح':'Saved successfully');setReview(false);setCancel(false)}}
    catch(error){setError(error.message||'Unable to save. Please retry.')}
    finally{setBusy(false)}
  }
  const chip=entry=><button key={entry.calendarId} className={`block w-full rounded-lg border px-2 py-1 text-start text-xs transition hover:shadow-sm ${entry.isRehearsal?'bg-slate-50 border-slate-200 text-slate-700':({green:'bg-emerald-50 border-emerald-200 text-emerald-800',blue:'bg-blue-50 border-blue-200 text-blue-800',orange:'bg-amber-50 border-amber-200 text-amber-800',purple:'bg-purple-50 border-purple-200 text-purple-800',pink:'bg-pink-50 border-pink-200 text-pink-800'}[eventType(entry).color])} ${entry.status==='cancelled'?'opacity-60 line-through':''}`} onClick={()=>setDetailId(entry.parentId)}>
    <span className="block font-semibold truncate">{entry.isRehearsal?(isAr?'بروفة · ':'Rehearsal · '):''}{entry.title}</span>
    <span className="block"><bdi>{formatClock(entry.time)}</bdi> · {labels[eventStage(entry)]}</span>
    <span className="block text-slate-500">{entry.isRehearsal?(isAr?'بروفة':'Rehearsal'):isAr?eventType(entry).ar:eventType(entry).en}</span>
  </button>
  const months=Array.from({length:3},(_,index)=>new Date(+bounds.start.slice(0,4),+bounds.start.slice(5,7)-1+index,1))
  return <section className="max-w-7xl space-y-5" aria-label={isAr?'الجدول ربع السنوي':'Quarterly schedule'} aria-busy={loading||busy}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-slate-500">KDEC Worship · Africa/Cairo</p><h1 className="mt-1 text-2xl font-display font-bold">{isAr?'الجدول ربع السنوي':'Quarterly calendar'}</h1><p className="mt-1 text-sm text-slate-500">{isAr?'كل فعاليات الفريق في مكان واحد.':'One place for every gathering, rehearsal and assignment.'}</p></div>
      <div className="flex flex-wrap gap-2"><Btn variant="secondary" icon={<Download size={16}/>} onClick={()=>{try{exportQuarterPDF({services:services.filter(event=>exportIds.has(event.id)),slots:quarterly.slots,people,year,quarter,isAr})}catch(error){setError(error.message)}}}>{isAr?'تصدير PDF':'Export PDF'}</Btn>{canCreate&&<Btn icon={<Plus size={16}/>} disabled={!planningReady&&!isDemoMode} onClick={()=>openDate(today>=bounds.start&&today<bounds.end?today:bounds.start)}>{isAr?'إضافة فعالية':'Add event'}</Btn>}</div>
    </div>
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label={isAr?'السنة':'Year'} value={year} onChange={event=>choose('year',event.target.value)}>{Array.from({length:201},(_,i)=>2000+i).map(value=><option key={value} value={value}>{value}</option>)}</Select>
        <Select label={isAr?'الربع':'Quarter'} value={quarter} onChange={event=>choose('quarter',event.target.value)}>{[1,2,3,4].map(q=><option key={q} value={q}>{isAr?'الربع':'Q'} {q}</option>)}</Select>
        <div className="min-w-0 flex-1"><Select label={isAr?'نوع الفعالية':'Event type'} value={kind} onChange={event=>setKind(event.target.value)}><option value="all">{isAr?'كل الأنواع':'All event types'}</option>{EVENT_TYPES.map(type=><option key={type.key} value={type.key}>{isAr?type.ar:type.en}</option>)}</Select></div>
        <Btn variant="secondary" disabled={busy||loading} onClick={()=>run(()=>loadAll())}>{loading?(isAr?'جارٍ التحميل…':'Loading…'):(isAr?'تحديث':'Refresh')}</Btn>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={mine} onChange={event=>setMine(event.target.checked)}/>{isAr?'تكليفاتي':'My assignments'}</label><label className="flex items-center gap-2"><input type="checkbox" checked={showCancelled} onChange={event=>setShowCancelled(event.target.checked)}/>{isAr?'عرض الملغاة':'Show cancelled'}</label></div>
        <div className="flex gap-1"><Btn size="sm" variant={view==='calendar'?'primary':'ghost'} aria-pressed={view==='calendar'} icon={<CalendarDays size={16}/>} onClick={()=>setView('calendar')}>{isAr?'تقويم':'Calendar'}</Btn><Btn size="sm" variant={view==='list'?'primary':'ghost'} aria-pressed={view==='list'} icon={<List size={16}/>} onClick={()=>setView('list')}>{isAr?'قائمة':'List'}</Btn></div>
      </div>
      {manager&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 p-3"><p className="text-sm text-indigo-800">{isAr?'حفظ المسودات لا يرسل إشعارات. النشر يرسل إشعارات داخل التطبيق للأعضاء المكلفين فقط.':'Drafts are silent. Publishing sends in-app notifications to assigned members and locks the event schedule.'} <strong>{drafts.length} {isAr?'مسودة':'drafts'}</strong></p><Btn size="sm" disabled={!drafts.length||busy} onClick={()=>setReview(true)}>{isAr?'مراجعة ونشر الربع':'Review & publish quarter'}</Btn></div>}
    </Card>
    {(!planningReady||!quarterly.ready)&&!isDemoMode&&<p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-800">{isAr?'إعداد التقويم غير مكتمل. طبّق ترحيل قاعدة البيانات ثم أعد التحميل.':'Calendar setup is incomplete. Apply the unified calendar migration and refresh before editing or publishing.'}</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}{success&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-700">{success}</p>}
    <div className="flex flex-wrap gap-2">{EVENT_TYPES.map(type=><Badge key={type.key} color={type.color}>{isAr?type.ar:type.en}</Badge>)}<Badge color="slate">{isAr?'بروفة':'Rehearsal'}</Badge></div>
    {!entries.length&&!loading&&<Card className="p-8 text-center text-slate-500">{mine?(isAr?'ليس لديك تكليفات في هذا الربع.':'You have no assignments in this quarter.'):(isAr?'لا توجد فعاليات. اختر تاريخاً لإضافة فعالية.':'No events yet. Choose a date or add an event to get started.')}</Card>}
    {view==='calendar'&&<div className="hidden md:block space-y-5">{months.map(month=>{
      const days=[];const end=endOfWeek(endOfMonth(month));for(let day=startOfWeek(startOfMonth(month));day<=end;day=addDays(day,1))days.push(day)
      return <Card key={month.toISOString()} className="overflow-hidden"><h2 className="px-5 py-4 text-lg font-semibold border-b border-slate-100">{format(month,'MMMM yyyy',{locale:isAr?ar:undefined})}</h2><div className="grid grid-cols-7">{(isAr?['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']).map(day=><div key={day} className="p-2 text-center text-xs text-slate-500 border-b border-slate-100">{day}</div>)}</div><div className="grid grid-cols-7">{days.map(day=>{const key=format(day,'yyyy-MM-dd'),inMonth=day.getMonth()===month.getMonth();return <div key={key} className={`min-h-28 min-w-0 border-b border-e border-slate-100 p-1.5 ${inMonth?'':'bg-slate-50'}`}><button className={`mb-1 rounded-full px-2 py-1 text-xs ${key===today?'bg-indigo-600 text-white':'text-slate-600'}`} disabled={!canCreate||!inMonth||(!planningReady&&!isDemoMode)} aria-label={`${isAr?'إضافة فعالية في':'Add event on'} ${key}`} onClick={()=>openDate(key)}>{format(day,'d')}{canCreate&&inMonth?' +':''}</button><div className="space-y-1">{inMonth&&entries.filter(entry=>entryOnDay(entry,key)).map(chip)}</div></div>})}</div></Card>
    })}</div>}
    <div className={`${view==='calendar'?'md:hidden':''} space-y-3`}>{entries.map(entry=><Card key={entry.calendarId} className="p-4"><button className="block w-full text-start space-y-2" onClick={()=>setDetailId(entry.parentId)}><div className="flex flex-wrap gap-2"><Badge color={entry.isRehearsal?'slate':eventType(entry).color}>{entry.isRehearsal?(isAr?'بروفة':'Rehearsal'):isAr?eventType(entry).ar:eventType(entry).en}</Badge><Badge color={eventStage(entry)==='cancelled'?'red':eventStage(entry)==='published'?'green':'slate'}>{labels[eventStage(entry)]}</Badge>{memberAssignmentStatus(entry,currentUser?.id)&&<Badge color="blue">{labels[memberAssignmentStatus(entry,currentUser?.id)]||labels.pending}</Badge>}</div><h3 className="font-semibold">{entry.title}</h3><p className="text-sm text-slate-500"><bdi>{entry.date}{entry.endDate!==entry.date?` → ${entry.endDate}`:''} · {formatClock(entry.time)}{entry.endTime?` – ${formatClock(entry.endTime)}`:''}</bdi></p>{entry.location&&<p className="text-sm text-slate-500">{entry.location}</p>}</button></Card>)}</div>
    <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="font-semibold cursor-pointer">{isAr?'إشعارات الجدول':'Schedule inbox'} ({quarterly.inbox.filter(n=>!n.readAt).length})</summary><div className="mt-3 space-y-3">{!quarterly.inbox.length&&<p className="text-sm text-slate-500">{isAr?'لا توجد إشعارات':'No notifications yet'}</p>}{quarterly.inbox.map(notification=><div key={notification.id} className="flex flex-wrap justify-between gap-2"><button className="text-start text-sm" onClick={()=>setDetailId(notification.serviceId)}>{labels[notification.kind]||notification.kind} · {services.find(s=>s.id===notification.serviceId)?.title}</button>{!notification.readAt&&<Btn size="sm" variant="ghost" disabled={busy} onClick={()=>run(()=>scheduleAction('read_schedule_notification',{p_id:notification.id}))}>{isAr?'تمت القراءة':'Mark read'}</Btn>}</div>)}</div></details>
    {form&&<PlanningEventForm key={form.event?.id||form.date} {...form} onClose={()=>setForm(null)} onSaved={()=>{setForm(null);setSuccess(isAr?'تم حفظ المسودة دون إرسال إشعارات':'Draft saved. No notifications sent.')}}/>}
    {detail&&<Modal open onClose={()=>{setDetailId(null);setCancel(false)}} title={detail.title} size="xl" footer={<div className="flex flex-wrap gap-2"><Btn variant="secondary" onClick={()=>{setDetailId(null);setCancel(false)}}>{isAr?'العودة للتقويم':'Back to calendar'}</Btn>{canEdit&&eventStage(detail)==='draft'&&<Btn onClick={()=>{setForm({event:detail});setDetailId(null)}}>{isAr?'تعديل المسودة':'Edit draft'}</Btn>}{canEdit&&detail.status!=='cancelled'&&<Btn variant="danger" disabled={busy} onClick={()=>setCancel(true)}>{isAr?'إلغاء الفعالية':'Cancel event'}</Btn>}{eventType(detail).worship&&<Btn variant="ghost" onClick={()=>navigate(`/services/${detail.id}?view=details`)}>{isAr?'فتح قائمة الترانيم':'Open setlist'}</Btn>}</div>}>
      <div className="space-y-4"><div className="flex gap-2"><Badge color={eventType(detail).color}>{isAr?eventType(detail).ar:eventType(detail).en}</Badge><Badge>{labels[eventStage(detail)]}</Badge></div><p><bdi>{detail.date}{detail.endDate&&detail.endDate!==detail.date?` → ${detail.endDate}`:''} · {formatClock(detail.time)} – {formatClock(detail.endTime)}</bdi> · Africa/Cairo</p><p>{detail.location||(isAr?'لم يحدد المكان':'Location not set')}</p>{rehearsalLocationUrl(detail.locationUrl)&&<a href={rehearsalLocationUrl(detail.locationUrl)} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">{isAr?'فتح الموقع':'Open location'}</a>}{detail.notes&&<p className="whitespace-pre-wrap" dir="auto">{detail.notes}</p>}
      {cancel&&<div className="rounded-xl bg-red-50 p-4 space-y-3"><p>{isAr?'إلغاء هذه الفعالية مع الاحتفاظ بالتكليفات والحضور والسجل؟':'Cancel this event and retain all assignments, attendance and decision history?'}</p><Btn variant="danger" disabled={busy} onClick={()=>run(()=>updateService(detail.id,{status:'cancelled'}))}>{isAr?'تأكيد الإلغاء':'Confirm cancellation'}</Btn>{error&&<p role="alert">{error}</p>}</div>}
      {canEdit&&<EventAttendanceOptions key={`${detail.id}:${detail.lateToleranceMode}:${detail.lateToleranceMinutes}:${detail.attendanceEnabled}`} event={detail}/>}
      {detail.participantIds?.length>0&&<p className="text-sm">{isAr?'المشاركون':'Participants'}: {detail.participantIds.map(id=>people.find(p=>p.id===id)?.name||'—').join('، ')}</p>}
      <ScheduleAssignments service={detail}/></div>
    </Modal>}
    {review&&<Modal open onClose={()=>!busy&&setReview(false)} title={isAr?'مراجعة الربع قبل النشر':'Review quarter before publishing'} size="lg" footer={<><Btn variant="secondary" disabled={busy} onClick={()=>setReview(false)}>{isAr?'عودة':'Back'}</Btn><Btn disabled={busy||!!issues.length||!planningReady||!quarterly.ready||isDemoMode} onClick={()=>run(()=>scheduleAction('publish_schedule_quarter',{p_start:bounds.start}))}>{isAr?'نشر وإشعار الفريق':'Publish and notify team'}</Btn></>}><div className="space-y-4"><p>{isAr?'النشر يرسل إشعارات داخل التطبيق للمكلفين فقط، ويقفل تواريخ الفعاليات والبروفات والتكليفات الأصلية. لن يتم إشعار أي شخص بمجرد حفظ مسودة.':'Publishing sends in-app notifications to assigned members, then locks dates, rehearsals and original assignments. Draft saves never notify members.'}</p>{isDemoMode&&<p className="text-amber-700">{isAr?'النشر يتطلب بيئة Supabase منفصلة للاختبار. العرض التجريبي لا يرسل إشعارات.':'Publishing requires an isolated Supabase environment. Demo mode sends no notifications.'}</p>}{drafts.map(event=><div key={event.id} className="border-b border-slate-100 pb-3"><strong>{event.title}</strong><p className="text-sm"><bdi>{event.date} · {formatClock(event.time)}</bdi> · {event.team.length} {isAr?'عضو':'members'}</p>{publicationIssues(event,worshipRoles).map(issue=><p key={issue} className="text-sm text-red-600">{planningMessage(issue,isAr)}</p>)}</div>)}{error&&<p role="alert" className="text-red-600">{error}</p>}</div></Modal>}
  </section>
}
