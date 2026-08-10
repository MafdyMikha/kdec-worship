import { useState } from 'react'
import { Plus, MapPin, Calendar, Clock, ChevronRight, Megaphone } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { isAdminUser } from '../lib/permissions.js'
import { Card, Btn, Badge, Avatar, Modal, Input, Select, Textarea, Tabs, EmptyState, ConfirmDialog } from '../components/ui'

const TYPE_COLORS = {
  'مؤتمر':'blue','معسكر':'green','ورشة عمل':'purple','فعالية خاصة':'orange','نشاط اجتماعي':'pink','خلوة':'indigo','تدريب':'amber',
  'Conference':'blue','Camp':'green','Workshop':'purple','Special Event':'orange','Social':'pink','Retreat':'indigo','Training':'amber',
}
const TYPE_GRADIENTS = {
  'مؤتمر':'from-blue-500 to-indigo-600','معسكر':'from-emerald-500 to-teal-600','ورشة عمل':'from-violet-500 to-purple-600',
  'فعالية خاصة':'from-amber-500 to-orange-600','نشاط اجتماعي':'from-pink-500 to-rose-600','خلوة':'from-indigo-500 to-violet-600','تدريب':'from-amber-400 to-yellow-500',
  'Conference':'from-blue-500 to-indigo-600','Camp':'from-emerald-500 to-teal-600','Workshop':'from-violet-500 to-purple-600',
  'Special Event':'from-amber-500 to-orange-600','Social':'from-pink-500 to-rose-600','Retreat':'from-indigo-500 to-violet-600','Training':'from-amber-400 to-yellow-500',
}

const BLANK = { title:'', titleEn:'', description:'', descriptionEn:'', date:format(new Date(),'yyyy-MM-dd'), endDate:'', time:'10:00', location:'', type:'', status:'upcoming' }

export default function Events() {
  const { isAr, t } = useLang()
  const { currentUser, people, events, eventResponses:responses, addEvent, updateEvent, deleteEvent, setEventResponse } = useStore()
  const isAdmin = isAdminUser(currentUser)
  const locale  = isAr ? arLocale : undefined

  const EVENT_TYPES_AR = ['مؤتمر','معسكر','ورشة عمل','فعالية خاصة','نشاط اجتماعي','خلوة','تدريب']
  const EVENT_TYPES_EN = ['Conference','Camp','Workshop','Special Event','Social','Retreat','Training']
  const EVENT_TYPES    = isAr ? EVENT_TYPES_AR : EVENT_TYPES_EN

  const RESPONSE_CONFIG = {
    attending:     { label: isAr?'حضور':'Attending',         color:'green',  bg:'bg-emerald-50 border-emerald-300 text-emerald-700' },
    not_attending: { label: isAr?'غياب':'Not Attending',     color:'red',    bg:'bg-red-50 border-red-300 text-red-700'             },
    maybe:         { label: isAr?'ربما':'Maybe',             color:'yellow', bg:'bg-amber-50 border-amber-300 text-amber-700'       },
    pending:       { label: isAr?'لم يرد':'No response',    color:'slate',  bg:'bg-slate-50 border-slate-200 text-slate-500'       },
  }

  const [tab,        setTab]        = useState('upcoming')
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form,       setForm]       = useState({...BLANK, type: isAr ? 'مؤتمر' : 'Conference'})

  const todayKey = format(new Date(),'yyyy-MM-dd')
  const upcoming = events.filter(e => e.date>=todayKey && !['past','cancelled'].includes(e.status))
  const past     = events.filter(e => e.date<todayKey || ['past','cancelled'].includes(e.status))
  const display  = tab==='upcoming' ? upcoming : tab==='past' ? past : events

  const myResponse  = (evtId) => responses[evtId]?.[currentUser?.id] || 'pending'
  const setResponse = (evtId, resp) => setEventResponse(evtId, resp)

  const getCounts = (evtId) => {
    const r = responses[evtId] || {}
    return {
      attending:     Object.values(r).filter(v=>v==='attending').length,
      not_attending: Object.values(r).filter(v=>v==='not_attending').length,
      maybe:         Object.values(r).filter(v=>v==='maybe').length,
    }
  }

  const openCreate = () => { setEditTarget(null); setForm({...BLANK, type: isAr?'مؤتمر':'Conference'}); setShowCreate(true) }
  const openEdit   = (evt) => { setEditTarget(evt.id); setForm({...evt}); setShowCreate(true) }

  const handleSave = async () => {
    if (!form.title || !form.date) return
    const result = editTarget ? await updateEvent(editTarget,form) : await addEvent(form)
    if (result?.error) return
    setShowCreate(false); setForm({...BLANK, type:isAr?'مؤتمر':'Conference'}); setEditTarget(null)
  }

  const handleDelete = async (evtId) => { const result=await deleteEvent(evtId); if (!result?.error) setDeleteTarget(null); return result }

  const formatDate = (d) => {
    if (!d) return ''
    try { return format(parseISO(d), isAr ? 'd MMMM yyyy' : 'MMM d, yyyy', {locale}) } catch { return d }
  }

  const STATUS_LABEL = {
    upcoming: isAr ? 'قادم' : 'Upcoming',
    ongoing:  isAr ? 'جاري' : 'Ongoing',
    past:     isAr ? 'منتهي' : 'Past',
    cancelled:isAr ? 'ملغي' : 'Cancelled',
  }

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs tabs={[
          { label: isAr?'قادم':'Upcoming', value:'upcoming', count:upcoming.length },
          { label: isAr?'منتهي':'Past', value:'past' },
          { label: isAr?'الكل':'All', value:'all', count:events.length },
        ]} active={tab} onChange={setTab}/>
        {isAdmin && <Btn onClick={openCreate} icon={<Plus size={16}/>}>{t('newEvent')}</Btn>}
      </div>

      {display.length === 0 ? (
        <EmptyState icon={<Megaphone size={28}/>} title={t('noEvents')}
          description={isAdmin ? (isAr?'أنشئ مؤتمرات وفعاليات لفريقك.':'Create conferences and events for your team.') : (isAr?'لا توجد فعاليات قادمة.':'No upcoming events.')}
          action={isAdmin && <Btn onClick={openCreate} icon={<Plus size={16}/>}>{t('newEvent')}</Btn>}/>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {display.map(evt => {
            const counts   = getCounts(evt.id)
            const myResp   = myResponse(evt.id)
            const total    = people.filter(p=>p.status==='active').length
            const gradient = TYPE_GRADIENTS[evt.type] || 'from-indigo-500 to-violet-600'
            const displayTitle = isAr ? evt.title : (evt.titleEn || evt.title)
            const displayDesc  = isAr ? evt.description : (evt.descriptionEn || evt.description)
            const responsesOpen = evt.status === 'upcoming' && (evt.endDate || evt.date) >= todayKey
            return (
              <Card key={evt.id} className="overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className={`h-2 bg-gradient-to-r ${gradient}`}/>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge color={TYPE_COLORS[evt.type]||'blue'} size="xs">{evt.type}</Badge>
                        <Badge color={evt.status==='upcoming'?'blue':evt.status==='cancelled'?'red':'slate'} size="xs">
                          {STATUS_LABEL[evt.status] || evt.status}
                        </Badge>
                      </div>
                      <h3 className="font-display font-semibold text-slate-800 text-lg leading-tight" dir={isAr?'rtl':'ltr'}>{displayTitle}</h3>
                      {isAr && evt.titleEn && <p className="text-xs text-slate-400 italic mt-0.5">{evt.titleEn}</p>}
                      {!isAr && evt.title && <p className="text-xs text-slate-400 italic mt-0.5" dir="rtl">{evt.title}</p>}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {isAdmin && (
                        <button onClick={() => openEdit(evt)} aria-label={isAr?'تعديل الفعالية':'Edit event'} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer">✏️</button>
                      )}
                      <button onClick={() => setShowDetail(evt)} aria-label={isAr?'عرض تفاصيل الفعالية':'View event details'} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <ChevronRight size={16} className="text-slate-400"/>
                      </button>
                    </div>
                  </div>

                  {displayDesc && <p className="text-sm text-slate-600 mb-3 line-clamp-2" dir={isAr?'rtl':'ltr'}>{displayDesc}</p>}

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar size={11}/>
                      {formatDate(evt.date)}{evt.endDate && ` — ${formatDate(evt.endDate)}`}
                    </span>
                    {evt.time && <span className="flex items-center gap-1"><Clock size={11}/>{evt.time}</span>}
                    {evt.location && <span className="flex items-center gap-1"><MapPin size={11}/>{evt.location}</span>}
                  </div>

                  {/* RSVP */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-semibold">{t('willYouAttend')}</span>
                      <span>{counts.attending} {isAr?'من':'of'} {total} {isAr?'حضور':'attending'}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full transition-all" style={{width:`${total>0?(counts.attending/total)*100:0}%`}}/>
                      <div className="bg-amber-400 h-full transition-all" style={{width:`${total>0?(counts.maybe/total)*100:0}%`}}/>
                      <div className="bg-red-400 h-full transition-all" style={{width:`${total>0?(counts.not_attending/total)*100:0}%`}}/>
                    </div>
                    {responsesOpen ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                        {['attending','not_attending','maybe'].map(resp => {
                          const c = RESPONSE_CONFIG[resp]
                          const isSelected = myResp === resp
                          return (
                            <button key={resp} onClick={() => setResponse(evt.id, resp)} aria-pressed={isSelected}
                              className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all select-none ${isSelected ? c.bg + ' border-2' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
                              {c.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500">
                        {isAr?'تم إغلاق الردود لهذه الفعالية.':'Responses are closed for this event.'}
                      </p>
                    )}
                    <div className="flex gap-4 text-xs text-center">
                      <span className="flex-1 text-emerald-600">✓ {counts.attending}</span>
                      <span className="flex-1 text-amber-500">? {counts.maybe}</span>
                      <span className="flex-1 text-red-500">✗ {counts.not_attending}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={isAdmin&&showCreate} onClose={() => { setShowCreate(false); setEditTarget(null) }}
        title={editTarget ? t('edit') : t('newEvent')} size="lg"
        footer={<>
          <Btn variant="secondary" onClick={() => { setShowCreate(false); setEditTarget(null) }}>{t('cancel')}</Btn>
          <Btn onClick={handleSave} disabled={!form.title||!form.date}>
            {editTarget ? t('saveChanges') : t('create')}
          </Btn>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('arabicTitle')} required value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} dir="rtl" placeholder="مؤتمر الشباب ٢٠٢٦"/>
            <Input label={t('englishTitle')} value={form.titleEn} onChange={e=>setForm(f=>({...f,titleEn:e.target.value}))} placeholder="Youth Conference 2026"/>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Input label={t('startDate')} required type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
            <Input label={t('endDate')} type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}/>
            <Input label={t('time')} type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label={t('eventType')} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              {EVENT_TYPES.map(tp=><option key={tp}>{tp}</option>)}
            </Select>
            <Input label={t('location')} placeholder={isAr?'قاعة الكنيسة، القاهرة...':'Church hall, Cairo...'} value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/>
          </div>
          <Textarea label={`${t('arabicTitle')} ${t('description')}`} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} dir="rtl"
            placeholder={isAr?'تفاصيل الفعالية...':'Event details in Arabic...'} rows={3}/>
          <Textarea label={`${t('description')} (EN)`} value={form.descriptionEn} onChange={e=>setForm(f=>({...f,descriptionEn:e.target.value}))} placeholder="Event details in English..."/>
        </div>
      </Modal>

      {/* Detail modal */}
      {showDetail && (
        <Modal open={!!showDetail} onClose={() => setShowDetail(null)}
          title={isAr ? showDetail.title : (showDetail.titleEn || showDetail.title)} size="lg"
          footer={isAdmin ? (
            <div className="flex justify-between w-full">
              <Btn variant="danger" onClick={() => { setDeleteTarget(showDetail.id); setShowDetail(null) }}>{isAr?'إلغاء الفعالية':'Cancel Event'}</Btn>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={() => setShowDetail(null)}>{t('close')}</Btn>
                <Btn onClick={() => { openEdit(showDetail); setShowDetail(null) }}>{t('edit')}</Btn>
              </div>
            </div>
          ) : <Btn variant="secondary" onClick={() => setShowDetail(null)}>{t('close')}</Btn>}>
          <div className="space-y-5">
            {isAr && showDetail.titleEn && <p className="text-slate-400 italic">{showDetail.titleEn}</p>}
            {!isAr && showDetail.title && <p className="text-slate-400 italic" dir="rtl">{showDetail.title}</p>}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600"><Calendar size={14}/>{formatDate(showDetail.date)}</div>
              {showDetail.time && <div className="flex items-center gap-2 text-slate-600"><Clock size={14}/>{showDetail.time}</div>}
              {showDetail.location && <div className="flex items-center gap-2 text-slate-600 col-span-2"><MapPin size={14}/>{showDetail.location}</div>}
            </div>
            {(isAr ? showDetail.description : (showDetail.descriptionEn || showDetail.description)) && (
              <p className="text-slate-700 text-sm leading-relaxed" dir={isAr?'rtl':'ltr'}>
                {isAr ? showDetail.description : (showDetail.descriptionEn || showDetail.description)}
              </p>
            )}
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">{t('responses')} ({people.filter(p=>p.status==='active').length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {people.filter(p=>p.status==='active').map(p => {
                  const resp = responses[showDetail.id]?.[p.id] || 'pending'
                  const cfg  = RESPONSE_CONFIG[resp]
                  return (
                    <div key={p.id} className="flex items-center gap-3">
                      <Avatar name={p.name} size="sm"/>
                      <div className="flex-1"><div className="text-sm font-medium text-slate-700">{p.name}</div><div className="text-xs text-slate-400">{p.role}</div></div>
                      <Badge color={cfg.color} size="xs">{cfg.label}</Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={isAdmin&&!!deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={()=>handleDelete(deleteTarget)}
        title={isAr?'إلغاء الفعالية':'Cancel event'} confirmLabel={isAr?'إلغاء الفعالية':'Cancel event'}
        message={isAr?'سيتم إخفاء الفعالية من القائمة القادمة مع الحفاظ على الردود والسجل.':'The event will leave the upcoming list while its responses and history are preserved.'}/>
    </div>
  )
}
