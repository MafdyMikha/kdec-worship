import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { isSuperAdminUser } from '../lib/permissions.js'
import { scheduleLabels } from '../lib/quarterlySchedule.js'
import { formatClock } from '../lib/time.js'
import { Card, Btn, Select } from './ui'

export default function ScheduleAssignments({service}) {
  const {people,currentUser,quarterly,scheduleAction}=useStore()
  const {isAr}=useLang()
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [selected,setSelected]=useState({})
  const labels=scheduleLabels[isAr?'ar':'en']
  const name=id=>people.find(p=>p.id===id)?.name || (isAr?'عضو':'Member')
  const run=async(action,args)=>{
    if(busy)return
    setBusy(true);setError('')
    try{const result=await scheduleAction(action,args);if(result?.error)setError(result.error)}
    catch{setError(isAr?'تعذر الحفظ، حاول مرة أخرى':'Unable to save. Please retry.')}
    finally{setBusy(false)}
  }
  return <div className="space-y-3">{error&&<p role="alert" className="text-red-600">{error}</p>}
    {[service].map(service=>{
      const slots=quarterly.slots.filter(s=>s.serviceId===service.id)
      const leader=slots.find(s=>s.leader)
      const canApprove=leader?.personId===currentUser.id&&leader?.state==='confirmed'
      return <Card key={service.id} className="p-5 space-y-3">
        <h3 className="font-semibold">{isAr?'الفريق المكلف':'Assigned team'}</h3>
        {service.declinedPersonIds?.includes(currentUser.id)&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-800">{isAr?'تم تسجيل اعتذارك عن هذا التكليف.':'Your decline has been recorded for this event.'}</p>}
        {service.practice?.enabled&&<p className="text-sm">{isAr?'البروفة':'Rehearsal'}: <bdi>{service.practice.date} · {formatClock(service.practice.time)}</bdi> · {service.practice.location}</p>}
        {leader&&leader.state!=='confirmed'&&<p className="text-amber-700">{leader.state==='vacant'?(isAr?'بانتظار اختيار قائد تسبيح بواسطة المسؤول الأعلى':'Awaiting Super Admin selection of a Worship Leader'):(isAr?'بانتظار تأكيد قائد التسبيح؛ موافقات البدلاء متوقفة':'Awaiting Worship Leader confirmation; replacement approvals are paused')}</p>}
        {slots.some(slot=>slot.state==='vacant')&&!leader&&<p className="text-amber-700">{isAr?'لا يوجد قائد تسبيح لاعتماد بديل. سيظل المكان شاغراً دون إشعار أي بديل.':'No Worship Leader is assigned to approve replacements. This vacancy remains open without notifying a candidate.'}</p>}
        {!slots.length&&!service.publishedAt&&!service.publishedSchedule&&<p className="text-sm text-slate-500">{isAr?'مسودة الجدول — لم يتم إرسال إشعارات':'Schedule draft — no notifications sent'}</p>}
        {!slots.length&&!service.team.length&&<p className="text-sm text-slate-500">{isAr?'لا توجد تكليفات لهذا الحدث.':'No team assignments for this event.'}</p>}
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
  </div>
}
