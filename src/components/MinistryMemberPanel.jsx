import { useState } from 'react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { hasPermission, isSuperAdminUser } from '../lib/permissions.js'
import { MEMBER_CATEGORIES, MINISTRY_ROLES, RATING_AUDIENCES, SERVING_STATUSES, ratingScore } from '../lib/ministry.js'
import { Btn, Card, Input, Select, Textarea } from './ui'

export function MinistryStatus() {
  const {ministry}=useStore(),{isAr}=useLang()
  if(ministry.loading)return <p role="status" className="text-sm text-slate-500">{isAr?'جارٍ تحميل بيانات الفريق…':'Loading ministry data…'}</p>
  if(ministry.ready)return null
  return <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{isAr?'ميزات الفريق الجديدة تحتاج ترحيل قاعدة البيانات ثم تحديث البيانات.':'Ministry features require the database migration, then a refresh.'} <code>MIGRATION_ministry_insights.sql</code>{ministry.error&&<p dir="auto">{ministry.error}</p>}<Btn variant="secondary" size="sm" className="mt-2" onClick={ministry.refresh}>{isAr?'تحديث':'Refresh'}</Btn></div>
}

export function RatingFields({criteria,values,onChange,isAr}) {
  return <div className="space-y-5">{criteria.map(criterion=><fieldset key={criterion.id}>
    <legend className="text-sm font-semibold mb-2">{isAr&&criterion.nameAr?criterion.nameAr:criterion.name} <span className="text-xs font-normal text-slate-400">({criterion.minimum}–{criterion.maximum})</span></legend>
    <div className="flex flex-wrap gap-2"><button type="button" aria-pressed={values[criterion.id]==null} onClick={()=>onChange({...values,[criterion.id]:null})} className={`min-h-11 rounded-lg border px-3 text-xs ${values[criterion.id]==null?'border-indigo-500 bg-indigo-50':'border-slate-200'}`}>{isAr?'بدون تقييم':'Unrated'}</button>{Array.from({length:criterion.maximum-criterion.minimum+1},(_,i)=>criterion.minimum+i).map(value=><button key={value} type="button" aria-label={`${isAr&&criterion.nameAr?criterion.nameAr:criterion.name}: ${value}`} aria-pressed={values[criterion.id]===value} onClick={()=>onChange({...values,[criterion.id]:value})} className={`min-h-11 min-w-11 rounded-lg border font-semibold ${values[criterion.id]===value?'bg-indigo-600 text-white border-indigo-600':'border-slate-200 hover:bg-slate-50'}`}>{value}</button>)}</div>
  </fieldset>)}{!criteria.length&&<p className="text-sm text-slate-500">{isAr?'أضف معايير التقييم أولاً من إعدادات التقييم.':'Add criteria in Rating settings first.'}</p>}</div>
}

export default function MinistryMemberPanel({person}) {
  const {ministry,currentUser}=useStore(),{isAr}=useLang(),lang=isAr?'ar':'en'
  const [category,setCategory]=useState(person.category||'member'),[status,setStatus]=useState(person.servingStatus||'active'),[quote,setQuote]=useState(person.leaderQuote||'')
  const [roles,setRoles]=useState(person.ministryRoles||[]),[audience,setAudience]=useState('musician'),[values,setValues]=useState({}),[comment,setComment]=useState('')
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const run=async action=>{setBusy(true);setError('');setMessage('');try{const result=await action();if(result?.error)setError(result.error);else setMessage(isAr?'تم الحفظ':'Saved')}catch(caught){setError(caught.message)}finally{setBusy(false)}}
  const criteria=ministry.criteria.filter(row=>row.active&&row.audience===audience).sort((a,b)=>a.displayOrder-b.displayOrder)
  const history=ministry.ratings.filter(row=>row.personId===person.id&&row.audience===audience).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  return <div className="space-y-5"><MinistryStatus/>
    <Card className="p-4 space-y-4"><h3 className="font-semibold">{isAr?'حالة الخدمة':'Serving profile'}</h3>
      <Select label={isAr?'فئة العضو':'Member category'} disabled={!hasPermission(currentUser,'users.edit')||busy} value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(MEMBER_CATEGORIES).filter(([key])=>key!=='outsider').map(([key,label])=><option key={key} value={key}>{label[lang]}</option>)}</Select>
      <Select label={isAr?'حالة الخدمة':'Serving status'} disabled={!hasPermission(currentUser,'users.edit')||busy} value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(SERVING_STATUSES).map(([key,label])=><option key={key} value={key}>{label[lang]}</option>)}</Select>
      <p className="text-xs text-slate-500">{isAr?'حالة الخدمة مستقلة عن صلاحية تسجيل الدخول.':'Serving status is separate from account sign-in access.'}</p>
      <Textarea label={isAr?'اقتباس قائد التسبيح':'Worship leader quote'} maxLength={1000} value={quote} disabled={!hasPermission(currentUser,'users.edit')||busy} onChange={e=>setQuote(e.target.value)}/>
      {hasPermission(currentUser,'users.edit')&&<Btn disabled={busy||!ministry.ready} onClick={()=>run(()=>ministry.saveMember({personId:person.id,category,servingStatus:status,leaderQuote:quote}))}>{isAr?'حفظ ملف الخدمة':'Save serving profile'}</Btn>}
    </Card>
    {isSuperAdminUser(currentUser)&&<Card className="p-4 space-y-3"><h3 className="font-semibold">{isAr?'صلاحيات إضافية':'Additional access roles'}</h3>{Object.entries(MINISTRY_ROLES).map(([key,role])=><label key={key} className="flex gap-3 items-center min-h-11"><input type="checkbox" checked={roles.includes(key)} disabled={busy} onChange={e=>setRoles(e.target.checked?[...roles,key]:roles.filter(value=>value!==key))}/>{role[lang]}</label>)}<Btn disabled={busy||!ministry.ready} onClick={()=>run(()=>ministry.setRoles(person.id,roles))}>{isAr?'حفظ الصلاحيات':'Save access roles'}</Btn></Card>}
    {hasPermission(currentUser,'ratings.view')&&<Card className="p-4 space-y-5"><Select label={isAr?'نوع التقييم':'Rating audience'} value={audience} onChange={e=>{setAudience(e.target.value);setValues({})}}>{Object.entries(RATING_AUDIENCES).map(([key,label])=><option key={key} value={key}>{label[lang]}</option>)}</Select>
      {hasPermission(currentUser,`ratings.${audience}`)&&<><RatingFields criteria={criteria} values={values} onChange={setValues} isAr={isAr}/><Textarea label={isAr?'تعليق اختياري':'Optional comment'} value={comment} maxLength={4000} onChange={e=>setComment(e.target.value)}/><Btn disabled={busy||!ministry.ready||!criteria.length} onClick={()=>run(()=>ministry.saveRating({personId:person.id,audience,comment,scores:criteria.filter(row=>values[row.id]!=null).map(row=>({criterionId:row.id,value:values[row.id]}))}))}>{isAr?'حفظ التقييم':'Save rating'}</Btn></>}
      <h4 className="font-semibold">{isAr?'سجل التقييمات':'Rating history'}</h4>{!history.length&&<p className="text-sm text-slate-500">{isAr?'لم يتم التقييم بعد':'Not rated yet'}</p>}{history.map(row=><details key={row.id} className="rounded-xl border p-3"><summary className="cursor-pointer text-sm">{row.createdAt.slice(0,10)} · {ratingScore(row.scores,row.scores)??'—'}% · {ministry.people.find(person=>person.id===row.evaluatorId)?.name||row.evaluatorId}</summary><div className="mt-3 space-y-2">{row.scores.map(score=><p key={score.criterionId} className="text-sm">{isAr&&score.nameAr?score.nameAr:score.name} · {score.value} / {score.maximum} · v{score.version}</p>)}<p className="text-sm whitespace-pre-wrap" dir="auto">{row.comment}</p></div></details>)}
    </Card>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{message&&<p role="status" className="text-sm text-emerald-700">{message}</p>}
  </div>
}

export function GuestMembers() {
  const {ministry,currentUser}=useStore(),{isAr}=useLang()
  const [editing,setEditing]=useState(null),[name,setName]=useState(''),[roles,setRoles]=useState(''),[status,setStatus]=useState('active'),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [search,setSearch]=useState('')
  const save=async()=>{setBusy(true);setError('');try{const result=await ministry.saveGuest({id:editing,name,roles:[...new Set(roles.split(/[,،]/).map(value=>value.trim()).filter(Boolean))],status});if(result.error)setError(result.error);else{setEditing(null);setName('');setRoles('')}}catch(caught){setError(caught.message)}finally{setBusy(false)}}
  return <div className="space-y-4"><MinistryStatus/><Input label={isAr?'بحث عن مشارك':'Search guests'} value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="grid gap-3 sm:grid-cols-2">{ministry.guests.filter(guest=>guest.name.toLowerCase().includes(search.toLowerCase())).map(guest=><Card key={guest.id} className="p-4"><h3 className="font-semibold" dir="auto">{guest.name}</h3><p className="text-sm text-slate-500">{guest.roles.join(' · ')} · {guest.status}</p>{hasPermission(currentUser,'users.edit')&&<Btn variant="ghost" onClick={()=>{setEditing(guest.id);setName(guest.name);setRoles(guest.roles.join(', '));setStatus(guest.status)}}>{isAr?'تعديل':'Edit'}</Btn>}</Card>)}</div>
    {hasPermission(currentUser,'users.edit')&&<Card className="p-4 space-y-3"><h3 className="font-semibold">{editing?(isAr?'تعديل مشارك':'Edit guest'):(isAr?'إضافة مشارك من خارج الفريق':'Add guest contributor')}</h3><Input label={isAr?'الاسم':'Name'} value={name} onChange={e=>setName(e.target.value)}/><Input label={isAr?'الأدوار (مفصولة بفاصلة)':'Roles (comma separated)'} value={roles} onChange={e=>setRoles(e.target.value)}/><Select label={isAr?'الحالة':'Status'} value={status} onChange={e=>setStatus(e.target.value)}><option value="active">{isAr?'نشط':'Active'}</option><option value="inactive">{isAr?'غير نشط':'Inactive'}</option><option value="on-leave">{isAr?'إجازة':'On leave'}</option></Select><p className="text-xs text-slate-500">{isAr?'لا يتم إنشاء حساب تسجيل دخول.':'This does not create a sign-in account.'}</p><Btn disabled={busy||!ministry.ready||!name.trim()||!roles.trim()} onClick={save}>{isAr?'حفظ':'Save'}</Btn>{editing&&<Btn variant="ghost" onClick={()=>{setEditing(null);setName('');setRoles('')}}>{isAr?'إلغاء':'Cancel'}</Btn>}</Card>}{error&&<p role="alert" className="text-red-700">{error}</p>}
  </div>
}
