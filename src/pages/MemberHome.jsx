import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Calendar, CheckCircle, AlertCircle, ChevronRight, Music2, Users, X } from 'lucide-react'
import { format, parseISO, differenceInMinutes, differenceInHours } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Badge, Btn, Modal, Textarea } from '../components/ui'
import InstrumentDisplay, { INSTRUMENT_COLORS } from '../components/instruments/InstrumentDisplay.jsx'
import { hasPermission } from '../lib/permissions.js'

function TimeUntil({ dateStr, timeStr, isAr }) {
  const [now, setNow] = useState(new Date())
  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),60000); return ()=>clearInterval(t) },[])
  const target = new Date(`${dateStr}T${timeStr||'00:00'}`)
  const mins   = differenceInMinutes(target, now)
  const hours  = differenceInHours(target, now)
  if (mins<0) return <span className="text-slate-400 text-xs">{isAr?'انتهت':'Ended'}</span>
  if (mins<30) return <span className="text-red-500 text-sm font-bold animate-pulse">⚡ {isAr?`تبدأ خلال ${mins} دقيقة!`:`Starts in ${mins}m!`}</span>
  if (mins<60) return <span className="text-amber-500 text-sm font-semibold">⏰ {isAr?`بعد ${mins} دقيقة`:`In ${mins}m`}</span>
  if (hours<24) return <span className="text-indigo-500 text-sm font-medium">🕐 {isAr?`بعد ${hours} ساعة و${mins%60} دقيقة`:`In ${hours}h ${mins%60}m`}</span>
  const days = Math.ceil(mins/1440)
  return <span className="text-slate-500 text-sm">📅 {isAr?`بعد ${days} ${days===1?'يوم':'أيام'}`:`In ${days} day${days>1?'s':''}`}</span>
}

function ExcuseModal({ open, onClose, onSubmit, serviceName, isAr }) {
  const [reason, setReason] = useState('')
  return (
    <Modal open={open} onClose={onClose} title={isAr?'تقديم عذر':'Submit Excuse'} size="sm"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>{isAr?'إلغاء':'Cancel'}</Btn>
        <Btn variant="danger" onClick={async()=>{ if(!reason.trim())return; const result=await onSubmit(reason); if(!result?.error){setReason('');onClose()} }} disabled={!reason.trim()}>{isAr?'إرسال العذر':'Send Excuse'}</Btn>
      </>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{isAr?'تقديم عذر عن:':'Excuse for:'} <strong>{serviceName}</strong></p>
        <Textarea label={isAr?'السبب (مطلوب)':'Reason (required)'} required placeholder={isAr?'يرجى توضيح سبب الغياب...':'Please explain your reason...'} value={reason} onChange={e=>setReason(e.target.value)} rows={4}/>
        <p className="text-xs text-slate-400">{isAr?'سيتم مراجعة عذرك من قبل المسؤول.':'Your excuse will be reviewed by the admin.'}</p>
      </div>
    </Modal>
  )
}

function SubModal({ open, onClose, onSubmit, service, myRole, people, isAr }) {
  const [note, setNote] = useState('')
  const subs = people.filter(p => {
    const roles = (Array.isArray(p.roles) && p.roles.length > 0) ? p.roles : (p.role ? [p.role] : [])
    return p.status === 'active' && roles.includes(myRole) && !service?.team.find(t => t.personId === p.id)
  })
  return (
    <Modal open={open} onClose={onClose} title={isAr?'طلب بديل':'Request Substitute'} size="md"
      footer={<><Btn variant="secondary" onClick={onClose}>{isAr?'إلغاء':'Cancel'}</Btn><Btn onClick={async()=>{const result=await onSubmit(note);if(!result?.error){setNote('');onClose()}}}>{isAr?'إرسال الطلب':'Send Request'}</Btn></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {isAr
            ? <>لا يمكنك الخدمة كـ <strong>{myRole}</strong> في <strong>{service?.title}</strong>؟</>
            : <>Can't serve as <strong>{myRole}</strong> in <strong>{service?.title}</strong>?</>}
        </p>
        {subs.length===0?(
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            {isAr?'لا يوجد بدائل متاحون بنفس الدور حالياً. سيتم إشعار المسؤول.':'No available substitutes with the same role. Admin will be notified.'}
          </div>
        ):(
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{isAr?`البدائل المتاحة (${subs.length})`:`Available Substitutes (${subs.length})`}</p>
            {subs.map(p=>(
              <div key={p.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                  {p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div><div className="text-sm font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-500">{((Array.isArray(p.roles) && p.roles.length>0) ? p.roles : (p.role?[p.role]:[])).join(', ')}</div></div>
              </div>
            ))}
          </div>
        )}
        <Textarea label={isAr?'ملاحظة للبديل (اختياري)':'Note for substitute (optional)'} placeholder={isAr?'أي ملاحظات خاصة...':'Any special notes...'} value={note} onChange={e=>setNote(e.target.value)} rows={3}/>
      </div>
    </Modal>
  )
}

export default function MemberHome() {
  const { isAr } = useLang()
  const {
    currentUser, services, people, songs, excuseRequests, substituteRequests,
    updateTeamMemberStatus, submitExcuse, requestSubstitute,
  } = useStore()
  const navigate   = useNavigate()
  const [excuseModal, setExcuseModal] = useState(null)
  const [subModal,    setSubModal]    = useState(null)

  const today  = new Date()
  const locale = isAr ? ar : undefined

  // My upcoming assignments
  const myServices = services
    .filter(s => s.status !== 'cancelled' && s.team.find(t=>t.personId===currentUser?.id) && s.date>=format(today,'yyyy-MM-dd'))
    .sort((a,b)=>parseISO(a.date)-parseISO(b.date))

  const nextSvc   = myServices[0]
  const colors    = INSTRUMENT_COLORS[currentUser?.role] || INSTRUMENT_COLORS['Vocalist']

  // Top songs
  const topSongs  = songs.filter(s => s.status !== 'inactive').sort((a,b)=>(b.usageCount||0)-(a.usageCount||0)).slice(0,5)

  const STATUS_COLORS = { confirmed:'green', pending:'yellow', declined:'red' }
  const STATUS_LABEL  = isAr
    ? { confirmed:'مؤكد', pending:'انتظار', declined:'معتذر' }
    : { confirmed:'Confirmed', pending:'Pending', declined:'Declined' }

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">

      {/* Hero card */}
      <div className={`rounded-2xl p-4 md:p-6 text-white bg-gradient-to-br ${colors?.bg||'from-indigo-500 to-violet-600'} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <InstrumentDisplay role={currentUser?.role} animated size="lg"/>
        </div>
        <div className="relative">
          <div className="text-white/70 text-sm mb-1">
            {isAr ? format(today,'EEEE، d MMMM',{locale:ar}) : format(today,'EEEE, MMMM d')}
          </div>
          <h2 className="font-display text-2xl font-bold mb-1">
            {isAr ? `أهلاً، ${currentUser?.name?.split(' ')[0]}! 🎵` : `Welcome, ${currentUser?.name?.split(' ')[0]}! 🎵`}
          </h2>
          <p className="text-white/80 text-sm">{((Array.isArray(currentUser?.roles) && currentUser.roles.length>0) ? currentUser.roles : (currentUser?.role?[currentUser.role]:[])).join(' · ')}</p>
          {nextSvc && (
            <div className="mt-4 flex items-center gap-2">
              <TimeUntil dateStr={nextSvc.date} timeStr={nextSvc.time} isAr={isAr}/>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My upcoming services */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-800">{isAr?'خدماتي القادمة':'My Upcoming Services'}</h3>
            <button onClick={()=>navigate('/schedule')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
              {isAr?'عرض الجدول':'View Schedule'} <ChevronRight size={14}/>
            </button>
          </div>

          {myServices.length===0 ? (
            <Card className="p-8 text-center">
              <Calendar size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm">{isAr?'لا توجد خدمات قادمة':'No upcoming services assigned'}</p>
            </Card>
          ) : myServices.slice(0,4).map(svc => {
            const entry = svc.team.find(t=>t.personId===currentUser?.id)
            const responseLocked = excuseRequests.some(request => (
              request.service_id===svc.id && request.person_id===currentUser?.id && ['pending','approved'].includes(request.status)
            )) || substituteRequests.some(request => (
              request.service_id===svc.id && request.requester_id===currentUser?.id && ['open','filled'].includes(request.status)
            ))
            const committedSubstitute = substituteRequests.some(request => (
              request.service_id===svc.id && request.substitute_id===currentUser?.id && request.status==='filled'
            ))
            return (
              <Card key={svc.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 text-center bg-slate-50 rounded-xl py-2">
                    <div className="text-xs font-medium text-slate-400">{format(parseISO(svc.date),'MMM',{locale})}</div>
                    <div className="text-2xl font-display font-bold text-slate-800">{format(parseISO(svc.date),'d')}</div>
                    <div className="text-xs text-slate-400">{format(parseISO(svc.date),'EEE',{locale})}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-display font-semibold text-slate-800">
                      <button onClick={()=>navigate(`/services/${svc.id}`)} className="text-start hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                        {svc.title}
                      </button>
                    </h4>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={12}/>{svc.time}</span>
                      <span className="flex items-center gap-1"><Music2 size={12}/>{svc.setlist.length} {isAr?'ترنيمة':'songs'}</span>
                      {entry && <Badge color={STATUS_COLORS[entry.status]||'slate'} size="xs">{STATUS_LABEL[entry.status]||entry.status}</Badge>}
                    </div>
                    {entry && (
                      <div className="flex gap-2 mt-3">
                        {entry.status!=='confirmed' && !responseLocked && (
                          <Btn variant="success" size="xs" onClick={()=>updateTeamMemberStatus(svc.id,currentUser.id,'confirmed')}>
                            <CheckCircle size={12}/> {isAr?'تأكيد':'Confirm'}
                          </Btn>
                        )}
                        {responseLocked && <button type="button" onClick={()=>navigate('/requests')}
                          className="text-xs text-amber-700 underline underline-offset-2 cursor-pointer">
                          {isAr?'راجع الطلبات':'Review requests'}
                        </button>}
                        {entry.status!=='declined' && !committedSubstitute && (
                          <Btn variant="secondary" size="xs" onClick={()=>setExcuseModal(svc)}>
                            <X size={12}/> {isAr?'اعتذار':'Excuse'}
                          </Btn>
                        )}
                        {!committedSubstitute && <Btn variant="outline" size="xs" onClick={()=>setSubModal(svc)}>
                          <Users size={12}/> {isAr?'بديل':'Sub'}
                        </Btn>}
                        {committedSubstitute && <span className="text-xs font-medium text-indigo-600">
                          {isAr?'مُعيّن كبديل':'Assigned substitute'}
                        </span>}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0"/>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Sidebar: top songs + quick links */}
        <div className="space-y-4">
          <div>
            <h3 className="font-display font-semibold text-slate-800 mb-3">{isAr?'أكثر الترانيم':'Top Songs'}</h3>
            <Card className="divide-y divide-slate-100">
              {topSongs.map((s,i)=>(
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xs font-bold text-slate-300 w-4">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{isAr?s.title:s.titleEn||s.title}</div>
                    <div className="text-xs text-slate-400">{s.key} · {s.usageCount} {isAr?'مرة':'times'}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <div>
            <h3 className="font-display font-semibold text-slate-800 mb-3">{isAr?'روابط سريعة':'Quick Links'}</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                {icon:<Calendar size={18}/>,label:isAr?'الجدول':'Schedule',to:'/schedule',color:'bg-indigo-50 text-indigo-600'},
                {icon:<Music2 size={18}/>,label:isAr?'الترانيم':'Songs',to:'/songs',color:'bg-violet-50 text-violet-600'},
                {icon:<Users size={18}/>,label:isAr?'الفريق':'Team',to:'/people',color:'bg-emerald-50 text-emerald-600',permission:'users.view'},
                {icon:<AlertCircle size={18}/>,label:isAr?'الإعلانات':'Announcements',to:'/announcements',color:'bg-amber-50 text-amber-600'},
              ].filter(item=>!item.permission||hasPermission(currentUser,item.permission)).map(({icon,label,to,color})=>(
                <button key={to} onClick={()=>navigate(to)}
                  className={`${color} rounded-xl p-3 flex flex-col items-center gap-1.5 text-xs font-medium hover:opacity-80 cursor-pointer transition-all`}>
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ExcuseModal
        open={!!excuseModal} onClose={()=>setExcuseModal(null)}
        serviceName={excuseModal?.title||''}
        onSubmit={reason=>submitExcuse(excuseModal?.id,reason)}
        isAr={isAr}
      />
      <SubModal
        open={!!subModal} onClose={()=>setSubModal(null)}
        service={subModal} myRole={subModal?.team.find(entry=>entry.personId===currentUser?.id)?.role||currentUser?.role}
        people={people} onSubmit={note=>requestSubstitute(subModal?.id,subModal?.team.find(entry=>entry.personId===currentUser?.id)?.role||currentUser?.role,note)} isAr={isAr}
      />
    </div>
  )
}
