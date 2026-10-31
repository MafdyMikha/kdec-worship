import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { EVENT_TYPES, cairoToday, eventKind, planningMessage, validatePlanningEvent } from '../lib/planningCalendar.js'
import { Btn, Input, Modal, Select, Textarea } from './ui'

export default function PlanningEventForm({event,date,onClose,onSaved}) {
  const {isAr}=useLang()
  const {savePlanningEvent,people,worshipRoles}=useStore()
  const [form,setForm]=useState(()=>event?{...event,eventKind:eventKind(event),endDate:event.endDate||event.date,endTime:event.endTime||'20:00',team:event.team.map(member=>({...member})),recurrence:{enabled:false}}:{eventKind:'youth_meeting',title:'',date:date||cairoToday(),endDate:date||cairoToday(),time:'18:00',endTime:'20:00',location:'',locationUrl:'',notes:'',team:[],practice:null,recurrence:{enabled:false,frequency:'weekly',count:8,endDate:''}})
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const set=fields=>setForm(previous=>({...previous,...fields}))
  const practice=fields=>set({practice:{...form.practice,...fields}})
  const recurring=fields=>set({recurrence:{...form.recurrence,...fields}})
  const multi=['conference','prayer_shift'].includes(form.eventKind)
  const save=async()=>{
    const invalid=validatePlanningEvent(form)
    if(invalid){setError(invalid);return}
    setBusy(true);setError('')
    try{const result=await savePlanningEvent(form);if(result?.error)setError(result.error);else onSaved(result)}
    catch(error){setError(error.message||'Unable to save. Please retry.')}
    finally{setBusy(false)}
  }
  return <Modal open onClose={()=>!busy&&onClose()} title={event?(isAr?'تعديل مسودة':'Edit draft'):(isAr?'إضافة فعالية':'Add event')} size="lg" footer={<><Btn variant="secondary" disabled={busy} onClick={onClose}>{isAr?'رجوع':'Cancel'}</Btn><Btn disabled={busy} onClick={save}>{busy?(isAr?'جارٍ الحفظ…':'Saving…'):(isAr?'حفظ المسودة':'Save draft')}</Btn></>}>
    <form onSubmit={e=>{e.preventDefault();void save()}} className="space-y-5" aria-busy={busy}>
      <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">{isAr?'توقيت القاهرة · حفظ المسودة لا يرسل أي إشعارات.':'Africa/Cairo · Saving a draft sends no notifications.'}</p>
      {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{planningMessage(error,isAr)}</p>}
      <Select label={isAr?'نوع الفعالية':'Event type'} value={form.eventKind} disabled={busy} onChange={e=>set({eventKind:e.target.value,...(!['conference','prayer_shift'].includes(e.target.value)?{endDate:form.date}:{})})}>{EVENT_TYPES.map(type=><option key={type.key} value={type.key}>{isAr?type.ar:type.en}</option>)}</Select>
      <Input label={isAr?'العنوان':'Title'} required maxLength={200} value={form.title} onChange={e=>set({title:e.target.value})}/>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={isAr?'التاريخ':'Date'} type="date" required value={form.date} onChange={e=>set({date:e.target.value,...(form.endDate===form.date||form.endDate<e.target.value?{endDate:e.target.value}:{})})}/>
        {multi&&<Input label={isAr?'تاريخ الانتهاء':'End date'} type="date" required min={form.date} value={form.endDate} onChange={e=>set({endDate:e.target.value})}/>}
        <Input label={isAr?'وقت البدء':'Start time'} type="time" required value={form.time} onChange={e=>set({time:e.target.value})}/>
        <Input label={isAr?'وقت الانتهاء':'End time'} type="time" required value={form.endTime} onChange={e=>set({endTime:e.target.value})}/>
      </div>
      {multi&&<p className="text-sm text-slate-500">{isAr?'للفترات التي تتجاوز منتصف الليل اختر اليوم التالي كتاريخ انتهاء.':'For an overnight shift, choose the following day as the end date.'}</p>}
      <Input label={isAr?'المكان':'Location'} value={form.location} onChange={e=>set({location:e.target.value})}/>
      <Input label={isAr?'رابط المكان (اختياري)':'Location link (optional)'} type="url" placeholder="https://maps.google.com/…" value={form.locationUrl||''} onChange={e=>set({locationUrl:e.target.value})}/>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{isAr?'تكليفات الفريق (اختياري)':'Team assignments (optional)'}</summary><div className="mt-4 space-y-3">
        <p className="text-sm text-slate-500">{isAr?'اجتماعات الشباب والخدمات تحتاج قائد تسبيح عند النشر. البدلاء يحتاجون موافقة قائد تسبيح مؤكد.':'Youth Meetings and Services need a Worship Leader when published. Replacement offers require a confirmed Worship Leader’s approval.'}</p>
        {form.team.map((member,index)=><div key={index} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1"><Select label={isAr?'العضو':'Member'} value={member.personId} onChange={e=>set({team:form.team.map((item,i)=>i===index?{...item,personId:e.target.value}:item)})}><option value="">{isAr?'اختر':'Choose'}</option>{people.filter(p=>p.status==='active'&&(!form.team.some((m,i)=>i!==index&&m.personId===p.id))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
          <div className="min-w-0 flex-1"><Select label={isAr?'الدور':'Role'} value={member.roleId} onChange={e=>set({team:form.team.map((item,i)=>i===index?{...item,roleId:e.target.value}:item)})}><option value="">{isAr?'اختر':'Choose'}</option>{worshipRoles.filter(role=>role.active&&people.find(p=>p.id===member.personId)?.roleIds?.includes(role.id)).map(role=><option key={role.id} value={role.id}>{role.name}</option>)}</Select></div>
          <Btn variant="ghost" aria-label={isAr?'حذف التكليف':'Remove assignment'} onClick={()=>set({team:form.team.filter((_,i)=>i!==index)})}><Trash2 size={16}/></Btn>
        </div>)}
        <Btn variant="secondary" icon={<Plus size={14}/>} onClick={()=>set({team:[...form.team,{personId:'',roleId:''}]})}>{isAr?'إضافة عضو':'Add member'}</Btn>
      </div></details>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{isAr?'البروفة (اختياري)':'Rehearsal (optional)'}</summary><div className="mt-4 space-y-3"><label className="flex items-center gap-2"><input type="checkbox" checked={!!form.practice?.enabled} onChange={e=>practice({enabled:e.target.checked})}/>{isAr?'إضافة بروفة':'Include a rehearsal'}</label>{form.practice?.enabled&&<>
        <div className="grid gap-3 sm:grid-cols-2"><Input label={isAr?'تاريخ البروفة':'Rehearsal date'} type="date" value={form.practice.date||''} onChange={e=>practice({date:e.target.value})}/><Input label={isAr?'وقت البروفة':'Rehearsal time'} type="time" value={form.practice.time||''} onChange={e=>practice({time:e.target.value})}/></div>
        <Input label={isAr?'مكان البروفة':'Rehearsal location'} value={form.practice.location||''} onChange={e=>practice({location:e.target.value})}/><Input label={isAr?'رابط مكان البروفة':'Rehearsal location link'} type="url" value={form.practice.locationUrl||''} onChange={e=>practice({locationUrl:e.target.value})}/>
      </>}</div></details>
      <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{isAr?'ملاحظات (اختياري)':'Notes (optional)'}</summary><div className="mt-4"><Textarea label={isAr?'ملاحظات':'Notes'} value={form.notes||''} onChange={e=>set({notes:e.target.value})}/></div></details>
      {!event&&<details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{isAr?'التكرار (اختياري)':'Recurrence (optional)'}</summary><div className="mt-4 space-y-3"><label className="flex items-center gap-2"><input type="checkbox" checked={!!form.recurrence.enabled} onChange={e=>recurring({enabled:e.target.checked})}/>{isAr?'تكرار هذه الفعالية':'Repeat this event'}</label>{form.recurrence.enabled&&<>
        <Select label={isAr?'التكرار':'Frequency'} value={form.recurrence.frequency} onChange={e=>recurring({frequency:e.target.value})}>{[['weekly','Weekly','أسبوعياً'],['biweekly','Every 2 weeks','كل أسبوعين'],['monthly','Monthly','شهرياً']].map(([key,en,ar])=><option key={key} value={key}>{isAr?ar:en}</option>)}</Select>
        <Input label={isAr?'عدد الفعاليات (٢–٥٢)':'Occurrences (2–52)'} type="number" min={2} max={52} value={form.recurrence.count} onChange={e=>recurring({count:Number(e.target.value)})}/><Input label={isAr?'ينتهي بحلول (اختياري)':'End by (optional)'} type="date" min={form.date} value={form.recurrence.endDate||''} onChange={e=>recurring({endDate:e.target.value})}/>
      </>}</div></details>}
    </form>
  </Modal>
}
