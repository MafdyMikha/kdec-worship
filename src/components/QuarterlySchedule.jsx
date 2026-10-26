import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { hasPermission, isSuperAdminUser } from '../lib/permissions.js'
import { quarterBounds, quarterServices, scheduleLabels } from '../lib/quarterlySchedule.js'
import { formatClock } from '../lib/time.js'
import { exportQuarterPDF } from '../lib/schedulePdf.js'
import { Card, Btn, Select, ConfirmDialog } from './ui'

export default function QuarterlySchedule() {
  const {services,people,currentUser,quarterly,scheduleAction,loadAll,isDemoMode}=useStore()
  const {isAr}=useLang()
  const navigate=useNavigate()
  const [year,setYear]=useState(new Date().getFullYear())
  const [quarter,setQuarter]=useState(Math.floor(new Date().getMonth()/3)+1)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [confirm,setConfirm]=useState(false)
  const [selected,setSelected]=useState({})
  const labels=scheduleLabels[isAr?'ar':'en']
  const bounds=quarterBounds(year,quarter)
  const list=quarterServices(services,year,quarter)
  const published=quarterly.quarters.some(q=>q.startsOn===bounds.start)
  const name=id=>people.find(p=>p.id===id)?.name || (isAr?'عضو':'Member')
  const run=async(action,args)=>{
    if(busy)return
    setBusy(true);setError('');setSuccess('')
    try{const result=await scheduleAction(action,args);if(result?.error)setError(result.error);else setSuccess(isAr?'تم الحفظ':'Saved successfully')}
    catch{setError(isAr?'تعذر الحفظ، حاول مرة أخرى':'Unable to save. Please retry.')}
    finally{setBusy(false);setConfirm(false)}
  }
  return <section className="space-y-4" aria-label={isAr?'الجدول ربع السنوي':'Quarterly schedule'}>
    <Card className="p-5 space-y-4">
      <h2 className="text-xl font-semibold">{isAr?'الجدول ربع السنوي':'Quarterly schedule'}</h2>
      <p className="text-sm text-slate-500">{isAr?'أنشئ الخدمات والفريق والبروفات، ثم انشر الربع لإرسال إشعارات داخل التطبيق.':'Create services, assign the team and rehearsals, then publish the quarter to send in-app notifications.'}</p>
      {(!quarterly.ready||isDemoMode)&&<p role="alert" className="text-amber-700">{isAr?'النشر يتطلب إعداد قاعدة البيانات. العرض متاح دون إرسال إشعارات.':'Publishing requires the database migration. Preview is available without sending notifications.'}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <Select label={isAr?'السنة':'Year'} value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:6},(_,i)=>new Date().getFullYear()-1+i).map(y=><option key={y} value={y}>{y}</option>)}</Select>
        <Select label={isAr?'الربع':'Quarter'} value={quarter} onChange={e=>setQuarter(Number(e.target.value))}>{[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}</Select>
        <Btn variant="secondary" disabled={busy} onClick={()=>loadAll()}>{isAr?'تحديث':'Refresh'}</Btn>
        <Btn variant="secondary" onClick={()=>{try{exportQuarterPDF({services:list,slots:quarterly.slots,people,year,quarter,isAr})}catch(e){setError(e.message)}}}>{isAr?'تصدير PDF':'Export PDF'}</Btn>
        {hasPermission(currentUser,'services.create')&&<Btn variant="secondary" onClick={()=>navigate('/services')}>{isAr?'إنشاء الخدمات':'Create services'}</Btn>}
        {hasPermission(currentUser,'schedules.manage')&&<Btn disabled={busy||!quarterly.ready||isDemoMode||!list.length} onClick={()=>setConfirm(true)}>{published?(isAr?'نشر الخدمات الجديدة':'Publish added services'):(isAr?'نشر الربع':'Publish quarter')}</Btn>}
        {published&&<span className="text-emerald-700">{isAr?'منشور':'Published'}</span>}
      </div>
      {error&&<p role="alert" className="text-red-600">{error}</p>}
      {success&&<p role="status" className="text-emerald-700">{success}</p>}
    </Card>
    <Card className="p-5 space-y-2">
      <h3 className="font-semibold">{isAr?'إشعارات الجدول':'Schedule inbox'}</h3>
      {!quarterly.inbox.length&&<p className="text-sm text-slate-500">{isAr?'لا توجد إشعارات':'No notifications yet'}</p>}
      {quarterly.inbox.map(n=><div key={n.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2"><button className="text-start" onClick={()=>navigate(`/services/${n.serviceId}?view=details`)}>{labels[n.kind]||n.kind} · {services.find(s=>s.id===n.serviceId)?.title}</button>{!n.readAt&&<Btn size="sm" variant="ghost" disabled={busy} onClick={()=>run('read_schedule_notification',{p_id:n.id})}>{isAr?'تمت القراءة':'Mark read'}</Btn>}</div>)}
    </Card>
    {!list.length&&<Card className="p-8 text-center">{isAr?'لا توجد خدمات لهذا الربع.':'No services in this quarter yet.'}</Card>}
    {list.map(service=>{
      const slots=quarterly.slots.filter(s=>s.serviceId===service.id)
      const leader=slots.find(s=>s.leader)
      const canApprove=leader?.personId===currentUser.id&&leader?.state==='confirmed'
      return <Card key={service.id} className="p-5 space-y-3">
        <button className="text-start font-semibold text-lg" onClick={()=>navigate(`/services/${service.id}?view=details`)}>{service.title}</button>
        <p><bdi>{service.date} · {formatClock(service.time)}</bdi> · {labels[service.status]||service.status}</p>
        {service.practice?.enabled&&<p className="text-sm">{isAr?'البروفة':'Rehearsal'}: <bdi>{service.practice.date} · {formatClock(service.practice.time)}</bdi> · {service.practice.location}</p>}
        {leader&&leader.state!=='confirmed'&&<p className="text-amber-700">{leader.state==='vacant'?(isAr?'بانتظار اختيار قائد تسبيح بواسطة المسؤول الأعلى':'Awaiting Super Admin selection of a Worship Leader'):(isAr?'بانتظار تأكيد قائد التسبيح؛ موافقات البدلاء متوقفة':'Awaiting Worship Leader confirmation; replacement approvals are paused')}</p>}
        {!slots.length&&<p className="text-sm text-slate-500">{isAr?'مسودة الجدول — لم يتم إرسال إشعارات':'Schedule draft — no notifications sent'}</p>}
        {!slots.length&&service.team.map(m=><p key={m.personId}>{m.person?.name||name(m.personId)} · {m.role} · {labels[m.status]||m.status}</p>)}
        {slots.map(slot=>{
          const proposal=quarterly.attempts.find(a=>a.slotId===slot.id&&a.state==='proposed')
          return <div key={slot.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="flex flex-wrap gap-2"><strong>{slot.role}</strong> · {slot.personId?name(slot.personId):'—'} · {labels[slot.state]}</p>
            {slot.personId===currentUser.id&&service.status==='scheduled'&&<div className="flex gap-2"><Btn size="sm" disabled={busy||slot.state==='confirmed'} onClick={()=>run('respond_schedule_assignment',{p_slot:slot.id,p_version:slot.version,p_status:'confirmed'})}>{isAr?'تأكيد':'Confirm'}</Btn><Btn size="sm" variant="secondary" disabled={busy} onClick={()=>run('respond_schedule_assignment',{p_slot:slot.id,p_version:slot.version,p_status:'declined'})}>{isAr?'اعتذار':'Decline'}</Btn></div>}
            {slot.state==='vacant'&&slot.leader&&isSuperAdminUser(currentUser)&&<div className="flex flex-wrap items-end gap-2"><Select label={isAr?'قائد التسبيح البديل':'Replacement Worship Leader'} value={selected[slot.id]||''} onChange={e=>setSelected({...selected,[slot.id]:e.target.value})}><option value="">{isAr?'اختر عضواً':'Choose a member'}</option>{people.filter(p=>p.status==='active'&&(p.roleIds?.includes(slot.roleId)||p.roles?.includes(slot.role))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select><Btn disabled={busy||!selected[slot.id]} onClick={()=>run('decide_schedule_replacement',{p_slot:slot.id,p_attempt:null,p_approve:true,p_candidate:selected[slot.id]})}>{isAr?'اختيار وإشعار':'Select and notify'}</Btn></div>}
            {slot.state==='vacant'&&!slot.leader&&canApprove&&(proposal?<div className="space-y-2"><p>{isAr?'البديل المقترح (لم يتم إشعاره)':'Proposed replacement (not notified)'}: {name(proposal.personId)}</p><div className="flex gap-2"><Btn size="sm" disabled={busy} onClick={()=>run('decide_schedule_replacement',{p_slot:slot.id,p_attempt:proposal.id,p_approve:true})}>{isAr?'موافقة وإشعار':'Approve and notify'}</Btn><Btn size="sm" variant="secondary" disabled={busy} onClick={()=>run('decide_schedule_replacement',{p_slot:slot.id,p_attempt:proposal.id,p_approve:false})}>{isAr?'رفض واقتراح آخر':'Reject and propose another'}</Btn></div></div>:<div><p>{isAr?'لا يوجد بديل مناسب؛ راجع الأدوار والتوافر.':'No eligible candidate; review roles and availability.'}</p><Btn size="sm" variant="secondary" disabled={busy} onClick={()=>run('retry_schedule_replacement',{p_slot:slot.id})}>{isAr?'إعادة البحث':'Retry search'}</Btn></div>)}
          </div>
        })}
        {(canApprove||isSuperAdminUser(currentUser))&&quarterly.audit.some(a=>slots.some(s=>s.id===a.slotId))&&<details className="border-t border-slate-200 pt-3 text-sm"><summary className="cursor-pointer font-medium">{isAr?'سجل قرارات التكليف':'Assignment decision history'}</summary><ol className="mt-2 space-y-2">{quarterly.audit.filter(a=>slots.some(s=>s.id===a.slotId)).map(a=><li key={a.id}><bdi>{new Date(a.createdAt).toLocaleString(isAr?'ar-EG':'en-GB',{timeZone:'Africa/Cairo',hour12:true})}</bdi> · {labels[a.action]||a.action} · {name(a.personId)}</li>)}</ol></details>}
      </Card>
    })}
    <ConfirmDialog open={confirm} onClose={()=>setConfirm(false)} title={isAr?'نشر الجدول؟':'Publish schedule?'} confirmLabel={isAr?'نشر وإشعار الفريق':'Publish and notify'} confirmVariant="primary" message={isAr?'سيتم إشعار الفريق داخل التطبيق وقفل التواريخ والتكليفات الأصلية.':'This sends in-app notifications and locks published dates and original assignments. Review every service first.'} onConfirm={()=>run('publish_schedule_quarter',{p_start:bounds.start})}/>
  </section>
}
