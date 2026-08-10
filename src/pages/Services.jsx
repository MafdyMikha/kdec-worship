import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Calendar, Music2, Users, CheckCircle, Clock, ChevronRight, Repeat } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { canManageWorship } from '../lib/permissions.js'
import { Card, Btn, Badge, SearchInput, Tabs, Modal, Input, Select, Textarea, EmptyState } from '../components/ui'

const SERVICE_TYPES_AR = ['خدمة أحد','ليلة صلاة','فعالية خاصة','خدمة شباب','عيد القيامة','عيد الميلاد','بروفة']
const SERVICE_TYPES_EN = ['Sunday Service','Prayer Night','Special Event','Youth Service','Easter','Christmas','Rehearsal']

const FREQ_AR = { weekly:'أسبوعياً', biweekly:'كل أسبوعين', monthly:'شهرياً' }
const FREQ_EN = { weekly:'Weekly', biweekly:'Every 2 weeks', monthly:'Monthly' }

function RecurrencePicker({ value, onChange, isAr }) {
  const on  = value?.enabled || false
  const set = (p) => onChange({ enabled:on, frequency:'weekly', count:8, endDate:'', ...value, ...p })
  const FREQ = isAr ? FREQ_AR : FREQ_EN
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl bg-slate-50">
        <div className="flex items-center gap-2.5">
          <Repeat size={16} className={on?'text-indigo-600':'text-slate-400'}/>
          <div>
            <div className="text-sm font-medium text-slate-700">{isAr?'تكرار هذه الخدمة':'Repeat this service'}</div>
            <div className="text-xs text-slate-400">{isAr?'إنشاء التكرارات تلقائياً':'Auto-create recurring occurrences'}</div>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label={isAr?'تكرار هذه الخدمة':'Repeat this service'} onClick={() => set({ enabled:!on })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${on?'bg-indigo-600':'bg-slate-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on?'translate-x-6':'translate-x-1'}`}/>
        </button>
      </div>
      {on && (
        <div className="space-y-3 pl-1 animate-slide-up">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{isAr?'التكرار':'Frequency'}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(FREQ).map(([k,label]) => (
                <button key={k} type="button" onClick={() => set({ frequency:k })}
                  className={`py-2.5 text-sm font-medium rounded-xl border cursor-pointer transition-all ${(value?.frequency||'weekly')===k?'bg-indigo-600 text-white border-indigo-600':'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{isAr?'عدد التكرارات':'Occurrences'}</label>
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
                <button type="button" onClick={() => set({ count:Math.max(2,(value?.count||8)-1) })} className="px-3 py-2.5 text-slate-500 hover:bg-slate-100 cursor-pointer text-lg font-bold">−</button>
                <span className="flex-1 text-center text-sm font-semibold text-slate-800">{value?.count||8}</span>
                <button type="button" onClick={() => set({ count:Math.min(52,(value?.count||8)+1) })} className="px-3 py-2.5 text-slate-500 hover:bg-slate-100 cursor-pointer text-lg font-bold">+</button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{isAr?'أو ينتهي في':'Or end by'}</label>
              <input type="date" value={value?.endDate||''} onChange={e => set({ endDate:e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-3 py-2.5 rounded-xl">
            <Repeat size={13}/>
            {isAr ? <>سيتم إنشاء <strong className="mx-1">{value?.count||8} خدمة</strong> {FREQ[value?.frequency||'weekly']}</> : <><strong className="mr-1">{value?.count||8} services</strong> {FREQ[value?.frequency||'weekly']}</>}
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceRow({ svc, services, navigate, isAr }) {
  const confirmed = svc.team.filter(t=>t.status==='confirmed').length
  const pending   = svc.team.filter(t=>t.status==='pending').length
  const statusColors = { scheduled:'blue', completed:'green', cancelled:'red', draft:'slate' }
  const statusLabels = isAr
    ? { scheduled:'مجدولة', completed:'مكتملة', cancelled:'ملغاة', draft:'مسودة' }
    : { scheduled:'Scheduled', completed:'Completed', cancelled:'Cancelled', draft:'Draft' }
  const groupMembers = svc.recurrenceGroupId ? services.filter(s=>s.recurrenceGroupId===svc.recurrenceGroupId).sort((a,b)=>a.date.localeCompare(b.date)) : []
  const groupSize = groupMembers.length
  const groupPosition = groupMembers.findIndex(service=>service.id===svc.id)+1
  return (
    <Card hover onClick={() => navigate(`/services/${svc.id}`)} className="p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-14 text-center">
          <div className="text-xs font-medium text-slate-400 uppercase">{format(parseISO(svc.date),'MMM')}</div>
          <div className="text-2xl font-display font-bold text-slate-800 leading-tight">{format(parseISO(svc.date),'d')}</div>
          <div className="text-xs text-slate-400">{format(parseISO(svc.date),'EEE')}</div>
        </div>
        <div className="w-px bg-slate-100 self-stretch"/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge color="blue" size="xs">{svc.type}</Badge>
            <Badge color={statusColors[svc.status]||'slate'} size="xs">{statusLabels[svc.status]||svc.status}</Badge>
            {groupSize>1 && (
              <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200 font-medium">
                <Repeat size={10}/> #{groupPosition} {isAr?'من':'of'} {groupSize}
              </span>
            )}
          </div>
          <h3 className="font-display font-semibold text-slate-800">{svc.title}</h3>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Clock size={12}/>{svc.time}</span>
            <span className="flex items-center gap-1"><Music2 size={12}/>{svc.setlist.length} {isAr?'ترنيمة':'songs'}</span>
            <span className="flex items-center gap-1"><Users size={12}/>{svc.team.length} {isAr?'عضو':'members'}</span>
            {confirmed>0&&<span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={12}/>{confirmed}</span>}
            {pending>0&&<span className="text-amber-500">{pending} {isAr?'انتظار':'pending'}</span>}
          </div>
        </div>
        <ChevronRight size={18} className="text-slate-300 flex-shrink-0 mt-1"/>
      </div>
    </Card>
  )
}

function RecurringGroup({ members, navigate, isAr }) {
  const [open, setOpen] = useState(false)
  const sorted = [...members].sort((a,b)=>parseISO(a.date)-parseISO(b.date))
  const first  = sorted[0]; const last = sorted[sorted.length-1]
  let freq = isAr?'أسبوعياً':'Weekly'
  if (sorted.length>=2) {
    const diff=Math.round((parseISO(sorted[1].date)-parseISO(sorted[0].date))/86400000)
    if(diff>=28)freq=isAr?'شهرياً':'Monthly'
    else if(diff>=14)freq=isAr?'كل أسبوعين':'Biweekly'
  }
  return (
    <div className="rounded-xl border border-violet-200 overflow-hidden shadow-sm">
      <button onClick={()=>setOpen(!open)} className="w-full p-4 bg-violet-50 flex items-center gap-4 cursor-pointer hover:bg-violet-100/60 transition-all text-left">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 flex-shrink-0"><Repeat size={18}/></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-display font-semibold text-slate-800">{first.title}</span>
            <Badge color="purple" size="xs">{members.length} {isAr?'تكرار':'occurrences'}</Badge>
          </div>
          <div className="text-xs text-slate-500">
            {format(parseISO(first.date),'MMM d')} → {format(parseISO(last.date),'MMM d, yyyy')} · {first.time} · <span className="text-violet-600 font-medium">{freq}</span>
          </div>
        </div>
        <ChevronRight size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${open?'rotate-90':''}`}/>
      </button>
      {open && (
        <div className="divide-y divide-slate-100 bg-white">
          {sorted.map(svc=>(
            <div key={svc.id} onClick={()=>navigate(`/services/${svc.id}`)} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 cursor-pointer transition-all">
              <div className="flex-shrink-0 w-10 text-center">
                <div className="text-xs text-slate-400">{format(parseISO(svc.date),'MMM')}</div>
                <div className="text-lg font-bold text-slate-700">{format(parseISO(svc.date),'d')}</div>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{format(parseISO(svc.date),'EEEE')}</span>
                <div className="text-xs text-slate-400 mt-0.5">{svc.setlist.length} {isAr?'ترنيمة':'songs'} · {svc.team.length} {isAr?'عضو':'members'}</div>
              </div>
              <ChevronRight size={14} className="text-slate-300"/>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const blankForm = { title:'', date:format(new Date(),'yyyy-MM-dd'), time:'10:00', type:'', notes:'', recurrence:{ enabled:false, frequency:'weekly', count:8, endDate:'' } }

export default function Services() {
  const { services, addService, currentUser } = useStore()
  const { t, isAr } = useLang()
  const navigate = useNavigate()
  const [tab,     setTab]     = useState('upcoming')
  const [search,  setSearch]  = useState('')
  const [grouped, setGrouped] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form,    setForm]    = useState({ ...blankForm, type: isAr?'خدمة أحد':'Sunday Service' })
  const todayKey = format(new Date(),'yyyy-MM-dd')
  const canManage = canManageWorship(currentUser)

  const SERVICE_TYPES = isAr ? SERVICE_TYPES_AR : SERVICE_TYPES_EN

  const filtered = services.filter(s => {
    const q = search.toLowerCase()
    const matchQ = s.title.toLowerCase().includes(q) || s.type.toLowerCase().includes(q)
    if (tab==='upcoming') return matchQ && s.date>=todayKey && s.status!=='completed' && s.status!=='cancelled'
    if (tab==='past')     return matchQ && (s.date<todayKey||s.status==='completed'||s.status==='cancelled')
    return matchQ
  }).sort((a,b)=>tab==='past'?parseISO(b.date)-parseISO(a.date):parseISO(a.date)-parseISO(b.date))

  const upcomingCount  = services.filter(s=>s.date>=todayKey&&s.status!=='completed'&&s.status!=='cancelled').length
  const recurringCount = [...new Set(services.filter(s=>s.recurrenceGroupId).map(s=>s.recurrenceGroupId))]
    .filter(groupId=>services.filter(service=>service.recurrenceGroupId===groupId).length>1).length

  const handleAdd = async () => {
    if (!form.title || !form.date) return
    const result = await addService({ ...form, status:'scheduled' })
    if (!result?.error) {
      setShowAdd(false)
      setForm({ ...blankForm, type: isAr?'خدمة أحد':'Sunday Service' })
    }
  }

  const renderList = () => {
    if (!grouped) return filtered.map(s=><ServiceRow key={s.id} svc={s} services={services} navigate={navigate} isAr={isAr}/>)
    const seen = new Set(); const rows = []
    filtered.forEach(svc => {
      const gid = svc.recurrenceGroupId
      if (!gid || services.filter(service=>service.recurrenceGroupId===gid).length<2) { rows.push(<ServiceRow key={svc.id} svc={svc} services={services} navigate={navigate} isAr={isAr}/>); return }
      if (!seen.has(gid)) { seen.add(gid); rows.push(<RecurringGroup key={gid} members={filtered.filter(s=>s.recurrenceGroupId===gid)} navigate={navigate} isAr={isAr}/>) }
    })
    return rows
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs tabs={[
          { label:t('upcoming'), value:'upcoming', count:upcomingCount },
          { label:t('past'),     value:'past' },
          { label:t('all'),      value:'all' },
        ]} active={tab} onChange={setTab}/>
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder={isAr?'ابحث في الخدمات...':'Search services...'} className="min-w-0 flex-1 sm:w-52 sm:flex-none"/>
          <button onClick={()=>setGrouped(!grouped)} title={isAr?'تجميع المتكررة':'Group recurring'}
            aria-label={isAr?'تجميع الخدمات المتكررة':'Group recurring services'} aria-pressed={grouped}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${grouped?'bg-violet-50 border-violet-300 text-violet-600':'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
            <Repeat size={16}/>
          </button>
          {canManage&&<Btn onClick={()=>setShowAdd(true)} icon={<Plus size={16}/>}>{t('newService')}</Btn>}
        </div>
      </div>

      {recurringCount>0 && tab!=='past' && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-700">
          <Repeat size={14}/> {recurringCount} {isAr?'سلسلة متكررة — استخدم':'recurring series — use'} <Repeat size={12} className="inline"/> {isAr?'للتجميع':'to group'}
        </div>
      )}

      {filtered.length===0
        ? <EmptyState icon={<Calendar size={28}/>}
            title={isAr?'لا توجد خدمات':'No services found'}
            description={tab==='upcoming'?(isAr?'لا توجد خدمات قادمة.':'No upcoming services.'):(isAr?'لا توجد نتائج.':'No results.')}
            action={canManage?<Btn onClick={()=>setShowAdd(true)} icon={<Plus size={16}/>}>{t('newService')}</Btn>:null}/>
        : <div className="space-y-3">{renderList()}</div>
      }

      <Modal open={canManage&&showAdd} onClose={()=>setShowAdd(false)} title={isAr?'إنشاء خدمة جديدة':'Create New Service'} size="lg"
        footer={<>
          <Btn variant="secondary" onClick={()=>setShowAdd(false)}>{t('cancel')}</Btn>
          <Btn onClick={handleAdd} disabled={!form.title||!form.date} icon={form.recurrence?.enabled?<Repeat size={14}/>:<Plus size={14}/>}>
            {form.recurrence?.enabled?(isAr?`إنشاء ${form.recurrence.count||8} خدمات`:`Create ${form.recurrence.count||8} Services`):(isAr?'إنشاء الخدمة':'Create Service')}
          </Btn>
        </>}>
        <div className="space-y-5">
          <Input label={isAr?'عنوان الخدمة':'Service Title'} required
            placeholder={isAr?'خدمة أحد الصباح':'Sunday Morning Worship'}
            value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('date')} required type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            <Input label={t('time')} type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/>
          </div>
          <Select label={isAr?'نوع الخدمة':'Service Type'} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            {SERVICE_TYPES.map(t=><option key={t}>{t}</option>)}
          </Select>
          <Textarea label={t('notes')} placeholder={isAr?'أي ملاحظات خاصة...':'Any special notes...'} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          <div className="border-t border-slate-100 pt-4">
            <RecurrencePicker value={form.recurrence} onChange={rec=>setForm(f=>({...f,recurrence:rec}))} isAr={isAr}/>
          </div>
        </div>
      </Modal>
    </div>
  )
}
