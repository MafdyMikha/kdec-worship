import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { hasPermission } from '../lib/permissions.js'
import { canEvaluate, RATING_AUDIENCES, ratingScore } from '../lib/ministry.js'
import { MinistryStatus, RatingFields } from '../components/MinistryMemberPanel.jsx'
import { Btn, Card, Input, Select, Textarea, Tabs } from '../components/ui'

const blank={name:'',nameAr:'',audience:'musician',minimum:1,maximum:5,weight:1,displayOrder:0,active:true}
function CriteriaSettings() {
  const {ministry}=useStore(),{isAr}=useLang()
  const [form,setForm]=useState(blank),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  const set=(key,value)=>{setSaved(false);setForm(previous=>({...previous,[key]:value}))}
  const save=async()=>{setBusy(true);setError('');try{const result=await ministry.saveCriterion(form);if(result.error)setError(result.error);else{setForm(blank);setSaved(true)}}catch(caught){setError(caught.message)}finally{setBusy(false)}}
  const latest=ministry.criteria.filter(row=>!ministry.criteria.some(other=>other.familyId===row.familyId&&other.version>row.version)).sort((a,b)=>a.displayOrder-b.displayOrder)
  return <div className="space-y-4"><p className="text-sm text-slate-500">{isAr?'التعديلات تنشئ إصداراً جديداً. التقييمات السابقة تحتفظ بمعاييرها وأوزانها الأصلية.':'Edits create a new version. Previous ratings retain their original criteria, scales and weights.'}</p>
    <div className="grid gap-3 sm:grid-cols-2">{latest.map(row=><Card key={row.id} className="p-4 space-y-2"><h3 className="font-semibold">{isAr&&row.nameAr?row.nameAr:row.name}</h3><p className="text-xs text-slate-500">{RATING_AUDIENCES[row.audience]?.[isAr?'ar':'en']} · {row.minimum}–{row.maximum} · {isAr?'الوزن':'Weight'} {row.weight} · v{row.version} · {row.active?(isAr?'نشط':'Active'):(isAr?'مؤرشف':'Archived')}</p><Btn variant="secondary" size="sm" disabled={busy} onClick={()=>{setForm(row);setSaved(false)}}>{isAr?'تعديل':'Edit'}</Btn></Card>)}</div>
    <Card className="p-4 space-y-4"><h3 className="font-semibold">{form.id?(isAr?'تعديل معيار':'Edit criterion'):(isAr?'معيار جديد':'New criterion')}</h3><Input label={isAr?'الاسم بالإنجليزية':'English name'} value={form.name} maxLength={150} onChange={e=>set('name',e.target.value)}/><Input label={isAr?'الاسم بالعربية':'Arabic name'} value={form.nameAr} maxLength={150} onChange={e=>set('nameAr',e.target.value)}/><Select label={isAr?'الفئة':'Audience'} value={form.audience} onChange={e=>set('audience',e.target.value)}>{Object.entries(RATING_AUDIENCES).map(([key,label])=><option key={key} value={key}>{label[isAr?'ar':'en']}</option>)}</Select><div className="grid grid-cols-2 gap-3">{[['minimum','Minimum','الحد الأدنى'],['maximum','Maximum','الحد الأقصى'],['weight','Weight','الوزن'],['displayOrder','Order','الترتيب']].map(([key,en,ar])=><Input key={key} label={isAr?ar:en} type="number" step={key==='weight'?'0.1':'1'} value={form[key]} onChange={e=>set(key,e.target.value===''?'':Number(e.target.value))}/>)}</div><label className="flex items-center gap-2 min-h-11"><input type="checkbox" checked={form.active} onChange={e=>set('active',e.target.checked)}/>{isAr?'نشط':'Active'}</label><div className="flex gap-2"><Btn disabled={busy||!ministry.ready} onClick={save}>{isAr?'حفظ المعيار':'Save criterion'}</Btn>{form.id&&<Btn variant="ghost" onClick={()=>setForm(blank)}>{isAr?'إلغاء':'Cancel'}</Btn>}</div>{error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}{saved&&<p role="status" className="text-emerald-700">{isAr?'تم حفظ المعيار':'Criterion saved'}</p>}</Card>
  </div>
}

export function RatingSettings() {
  const {isAr}=useLang()
  return <section className="max-w-3xl space-y-5"><h1 className="text-2xl font-display font-bold">{isAr?'إعدادات التقييم':'Rating settings'}</h1><MinistryStatus/><CriteriaSettings/></section>
}

function EvaluationForm({service,personId,audience,onNext}) {
  const {ministry,currentUser,people}=useStore(),{isAr}=useLang()
  const prior=ministry.evaluations.find(row=>row.serviceId===service.id&&row.personId===personId&&row.audience===audience&&row.evaluatorId===currentUser.id)
  const [values,setValues]=useState(()=>Object.fromEntries((prior?.scores||[]).map(score=>[score.criterionId,score.value])))
  const [comment,setComment]=useState(prior?.comment||''),[revision,setRevision]=useState(prior?.revision),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const criteria=ministry.criteria.filter(row=>row.active&&row.audience===audience).sort((a,b)=>a.displayOrder-b.displayOrder)
  const person=[...people,...ministry.guests].find(row=>row.id===personId)
  const save=async(state,next=false)=>{setBusy(true);setError('');setMessage('');try{const result=await ministry.saveRating({personId:personId,serviceId:service.id,audience,comment,state,revision,scores:criteria.filter(row=>values[row.id]!=null).map(row=>({criterionId:row.id,value:values[row.id]}))});if(result.error)setError(result.error);else{setRevision((revision||0)+1);setMessage(isAr?'تم حفظ التقييم':'Evaluation saved');if(next)onNext()}}catch(caught){setError(caught.message)}finally{setBusy(false)}}
  const revisions=ministry.revisions.filter(row=>row.evaluationId===prior?.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  return <Card className="p-4 sm:p-6 space-y-5"><div><p className="text-xs text-slate-500">{service.date} · {service.title}</p><h2 className="mt-1 text-xl font-semibold" dir="auto">{person?.name||personId}</h2><p className="text-xs text-indigo-700 mt-1">{isAr?'خاص بالمسؤول التقني والمسؤول الأعلى فقط':'Private to Technical Admins and Super Admins'}</p></div>
    <RatingFields criteria={criteria} values={values} onChange={setValues} isAr={isAr}/><Textarea label={isAr?'ملاحظات اختيارية':'Optional feedback'} rows={3} maxLength={4000} value={comment} onChange={e=>setComment(e.target.value)}/>
    {error&&<p role="alert" className="text-red-700 text-sm">{error}</p>}{message&&<p role="status" className="text-emerald-700 text-sm">{message}</p>}
    <div className="flex flex-wrap gap-2"><Btn variant="secondary" disabled={busy||!ministry.ready} onClick={()=>save('draft')}>{isAr?'حفظ مسودة':'Save draft'}</Btn><Btn disabled={busy||!ministry.ready||!criteria.length} onClick={()=>save('submitted')}>{isAr?'إرسال':'Submit'}</Btn><Btn variant="secondary" disabled={busy||!ministry.ready||!criteria.length} onClick={()=>save('submitted',true)}>{isAr?'إرسال والتالي':'Submit & next'}</Btn></div>
    {!!revisions.length&&<details><summary className="cursor-pointer text-sm font-semibold">{isAr?'سجل الإصدارات':'Revision history'} ({revisions.length})</summary><div className="mt-3 space-y-3">{revisions.map(row=><div key={row.id} className="rounded-xl border p-3 text-sm"><p>{row.createdAt.slice(0,16).replace('T',' ')} · v{row.snapshot.revision} · {row.snapshot.state} · {ratingScore(row.snapshot.scores,row.snapshot.scores)??'—'}%</p>{row.snapshot.scores.map(score=><p key={score.criterionId}>{isAr&&score.nameAr?score.nameAr:score.name}: {score.value}/{score.maximum}</p>)}<p className="whitespace-pre-wrap" dir="auto">{row.snapshot.comment}</p></div>)}</div></details>}
  </Card>
}

export default function Evaluations() {
  const {ministry,currentUser}=useStore(),{isAr}=useLang(),[params]=useSearchParams()
  const [tab,setTab]=useState('evaluate'),[serviceId,setServiceId]=useState(params.get('service')||''),[personId,setPersonId]=useState(''),[audience,setAudience]=useState('musician'),[search,setSearch]=useState('')
  if(!canEvaluate(currentUser))return null
  const services=ministry.services.filter(row=>row.status==='completed').sort((a,b)=>b.date.localeCompare(a.date))
  const service=services.find(row=>row.id===serviceId)
  const participants=[...new Set((service?.team||[]).map(member=>member.personId))]
  const selected=participants.includes(personId)?personId:participants[0]||''
  const submitted=ministry.evaluations.filter(row=>row.serviceId===serviceId&&row.evaluatorId===currentUser.id&&row.audience===audience&&row.state==='submitted').length
  const allPeople=[...ministry.people,...ministry.guests]
  return <section className="max-w-3xl space-y-5"><h1 className="text-2xl font-display font-bold">{isAr?'التقييمات':'Evaluations'}</h1><MinistryStatus/><Tabs tabs={[{value:'evaluate',label:isAr?'تقييم الخدمة':'Service feedback'},...(hasPermission(currentUser,'ratings.configure')?[{value:'criteria',label:isAr?'إعدادات التقييم':'Rating settings'}]:[])]} active={tab} onChange={setTab}/>
    {tab==='criteria'?<CriteriaSettings/>:<><Card className="p-4 space-y-4"><details open={!service}><summary className="cursor-pointer text-sm font-semibold">{service?`${service.title} · ${RATING_AUDIENCES[audience][isAr?'ar':'en']}`:(isAr?'اختيار الخدمة وفئة التقييم':'Choose service & rating audience')}</summary><div className="mt-3 space-y-3"><Input label={isAr?'بحث في الخدمات':'Search services'} value={search} onChange={e=>setSearch(e.target.value)}/><Select label={isAr?'الخدمة المكتملة':'Completed service'} value={serviceId} onChange={e=>{setServiceId(e.target.value);setPersonId('')}}><option value="">{isAr?'اختر خدمة':'Choose a service'}</option>{services.filter(row=>row.id===serviceId||row.title.toLowerCase().includes(search.toLowerCase())).map(row=><option key={row.id} value={row.id}>{row.date} · {row.title}</option>)}</Select><Select label={isAr?'فئة التقييم':'Rating audience'} value={audience} onChange={e=>setAudience(e.target.value)}>{Object.entries(RATING_AUDIENCES).map(([key,label])=><option key={key} value={key}>{label[isAr?'ar':'en']}</option>)}</Select></div></details>{service&&<><Select label={isAr?'العضو':'Member'} value={selected} onChange={e=>setPersonId(e.target.value)}>{participants.map(id=><option key={id} value={id}>{allPeople.find(row=>row.id===id)?.name||id}</option>)}</Select><p className="text-sm text-slate-500" aria-live="polite">{submitted}/{participants.length} {isAr?'تقييمات مرسلة لهذه الفئة':'submitted for this audience'}</p></>}</Card>
    {service&&selected?<EvaluationForm key={`${service.id}:${selected}:${audience}`} service={service} personId={selected} audience={audience} onNext={()=>setPersonId(participants[(participants.indexOf(selected)+1)%participants.length])}/>:<p className="text-sm text-slate-500">{isAr?'اختر خدمة مكتملة بها أعضاء لتبدأ.':'Choose a completed service with participants to start.'}</p>}</>}
  </section>
}
