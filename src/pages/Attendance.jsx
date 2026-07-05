import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, CheckCircle, Clock, X, Plus, Printer, RefreshCw, CheckCheck, ChevronDown, Calendar } from 'lucide-react'
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn, Badge, Avatar, Modal, StatCard, Tabs } from '../components/ui'
import { KDEC_LOGO } from '../assets/kdecLogo.js'

const SESSION_TYPES = [
  { key:'Service',              icon:'🎵', color:'bg-indigo-100 text-indigo-600'   },
  { key:'Practice',             icon:'🎸', color:'bg-emerald-100 text-emerald-600' },
  { key:'Soundcheck',           icon:'🔊', color:'bg-blue-100 text-blue-600'       },
  { key:'Team Meeting',         icon:'👥', color:'bg-amber-100 text-amber-600'     },
  { key:'Worship Team Meeting', icon:'🙏', color:'bg-violet-100 text-violet-600'   },
  { key:'Rehearsal',            icon:'📋', color:'bg-rose-100 text-rose-600'       },
]
const SESSION_LABEL = {
  ar: { Service:'خدمة', Practice:'بروفة', Soundcheck:'ساوند تشيك', 'Team Meeting':'اجتماع الفريق', 'Worship Team Meeting':'اجتماع فريق التسبيح', Rehearsal:'بروفة كاملة' },
  en: { Service:'Service', Practice:'Practice', Soundcheck:'Soundcheck', 'Team Meeting':'Team Meeting', 'Worship Team Meeting':'Worship Meeting', Rehearsal:'Rehearsal' },
}
const getSession = (key) => SESSION_TYPES.find(s => s.key === key) || SESSION_TYPES[0]
const makeToken  = () => Math.random().toString(36).slice(2,12).toUpperCase()

const PERIODS_AR = { total:'إجمالي', monthly:'شهرياً', weekly:'أسبوعياً' }
const PERIODS_EN = { total:'Total',   monthly:'Monthly', weekly:'Weekly'   }

function ExcuseLimitEditor({ lateMins, onLateMins, excuseLimit, excusePeriod, onExcuseLimit, onExcusePeriod, t, isAr }) {
  const [open, setOpen] = useState(false)
  const PERIODS = isAr ? PERIODS_AR : PERIODS_EN
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:border-slate-300 cursor-pointer shadow-sm">
        <Clock size={13} className="text-amber-500"/>
        {isAr ? 'تأخير' : 'Late'}: <strong>{lateMins}{isAr?'د':'m'}</strong>
        <span className="text-slate-300">|</span>
        {isAr ? 'أعذار' : 'Excuses'}: <strong>{excuseLimit}</strong> {PERIODS[excusePeriod]}
        <ChevronDown size={13} className={`transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 w-72 space-y-4 animate-scale-in">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {isAr ? 'حد التأخير المقبول (دقائق)' : 'Late tolerance (minutes)'}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => onLateMins(m => Math.max(1, m-5))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer text-lg font-bold">−</button>
              <span className="flex-1 text-center font-bold text-slate-800 text-lg">{lateMins}</span>
              <button onClick={() => onLateMins(m => Math.min(120, m+5))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer text-lg font-bold">+</button>
              <span className="text-sm text-slate-500">{isAr ? 'دقيقة' : 'min'}</span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {isAr ? 'الحد المسموح للأعذار' : 'Max excuses allowed'}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => onExcuseLimit(l => Math.max(0,l-1))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer text-lg font-bold">−</button>
              <span className="flex-1 text-center font-bold text-slate-800 text-lg">{excuseLimit}</span>
              <button onClick={() => onExcuseLimit(l => Math.min(20,l+1))} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer text-lg font-bold">+</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {Object.entries(PERIODS).map(([key, label]) => (
                <button key={key} onClick={() => onExcusePeriod(key)}
                  className={`py-1.5 text-xs font-medium rounded-lg border cursor-pointer transition-all ${excusePeriod===key?'bg-indigo-600 text-white border-indigo-600':'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer border-t border-slate-100 pt-3">
            {t('close')}
          </button>
        </div>
      )}
    </div>
  )
}

function QRModal({ open, onClose, session, service, t, isAr, lang }) {
  const qrRef = useRef(null)
  if (!session) return null
  const url = `${window.location.origin}/checkin/${session.qr_code}`
  const st  = getSession(session.label)
  const stLabel = SESSION_LABEL[lang]?.[session.label] || session.label

  const handlePrint = () => {
    const win = window.open('','_blank')
    win.document.write(`<html><head><title>QR</title>
    <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;background:#f8fafc;gap:10px}
    h1{font-size:20px;font-weight:700;margin:0} p{color:#64748b;font-size:13px;margin:2px 0}
    .badge{background:#ede9fe;color:#7c3aed;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700}
    .qr{background:white;padding:20px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);margin:12px 0}
    </style></head><body>
    <img src="${KDEC_LOGO}" style="width:50px;border-radius:8px"/>
    <h1>${service?.title || 'KDEC Worship'}</h1>
    <p>${service?.date} · ${session.session_time}</p>
    <div class="badge">${st.icon} ${stLabel}</div>
    <div class="qr">${qrRef.current?.innerHTML||''}</div>
    <p style="font-size:12px;color:#94a3b8">${isAr ? 'امسح لتسجيل الحضور' : 'Scan to check in'}</p>
    </body></html>`)
    win.document.close(); win.print()
  }

  return (
    <Modal open={open} onClose={onClose} title={`QR — ${stLabel}`} size="sm"
      footer={<><Btn variant="secondary" onClick={onClose}>{t('close')}</Btn><Btn onClick={handlePrint} icon={<Printer size={14}/>}>{t('print')}</Btn></>}>
      <div className="text-center space-y-4">
        <div className="text-sm text-slate-500">{service?.title} · {service?.date}</div>
        <div className="flex justify-center p-6 bg-white border-2 border-slate-100 rounded-2xl" ref={qrRef}>
          <QRCodeSVG value={url} size={200} level="M" includeMargin
            imageSettings={{src:KDEC_LOGO,height:28,width:28,excavate:true}}/>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">{isAr ? 'رابط الحضور:' : 'Check-in URL:'}</p>
          <p className="text-xs font-mono text-slate-600 break-all text-left">{url}</p>
        </div>
      </div>
    </Modal>
  )
}

function CheckInWidget({ session, record, lateMins, onCheckIn, onCheckOut, t, isAr }) {
  const [loading, setLoading] = useState(false)
  const doAction = async (type) => {
    setLoading(true)
    await new Promise(r => setTimeout(r,600))
    type==='in' ? onCheckIn() : onCheckOut()
    setLoading(false)
  }
  const getLate = () => {
    if (!record?.check_in_at || !session?.session_time) return null
    const start = new Date(`${session.service?.date||new Date().toISOString().slice(0,10)}T${session.session_time}`)
    const mins  = differenceInMinutes(new Date(record.check_in_at), start)
    if (mins <= 0)        return { label: isAr ? 'في الوقت ✓' : 'On Time ✓',                               cls:'bg-emerald-100 text-emerald-700' }
    if (mins <= lateMins) return { label: isAr ? `متأخر ${mins} دقيقة (مقبول)` : `${mins}m late (OK)`,     cls:'bg-amber-100 text-amber-700' }
    return                       { label: isAr ? `متأخر ${mins} دقيقة` : `${mins} min late`,                cls:'bg-red-100 text-red-700' }
  }

  if (!record?.check_in_at) return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto"><QrCode size={28} className="text-indigo-500"/></div>
      <div><p className="font-semibold text-slate-700">{isAr ? 'سجّل حضورك' : 'Check In'}</p><p className="text-xs text-slate-400 mt-1">{isAr ? 'امسح كود QR أو اضغط الزر' : 'Scan QR code or tap button'}</p></div>
      <button onClick={() => doAction('in')} disabled={loading}
        className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl cursor-pointer hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center gap-2 mx-auto">
        {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <CheckCircle size={18}/>}
        {loading ? (isAr ? 'جاري...' : 'Loading...') : t('checkIn')}
      </button>
    </div>
  )
  if (!record.check_out_at) {
    const late = getLate()
    return (
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto"><CheckCheck size={28} className="text-emerald-600"/></div>
        <div>
          <p className="font-bold text-emerald-700 text-lg">{isAr ? 'تم تسجيل الحضور ✓' : 'Checked In ✓'}</p>
          <p className="text-sm text-slate-500">{isAr ? 'وقت الدخول:' : 'Check-in time:'} {format(new Date(record.check_in_at),'h:mm a')}</p>
          {late && <span className={`inline-block mt-1.5 px-3 py-1 rounded-full text-xs font-semibold ${late.cls}`}>{late.label}</span>}
        </div>
        <button onClick={() => doAction('out')} disabled={loading}
          className="px-6 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl cursor-pointer hover:bg-amber-600 disabled:opacity-60 transition-all flex items-center gap-2 mx-auto">
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <X size={15}/>}
          {loading ? '...' : t('checkOut')}
        </button>
      </div>
    )
  }
  return (
    <div className="text-center space-y-2">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto"><CheckCheck size={28} className="text-slate-400"/></div>
      <p className="font-semibold text-slate-600">{isAr ? 'تم تسجيل المغادرة' : 'Checked Out'}</p>
      <p className="text-xs text-slate-400">
        {isAr ? 'دخول' : 'In'}: {format(new Date(record.check_in_at),'h:mm a')} · {isAr ? 'خروج' : 'Out'}: {format(new Date(record.check_out_at),'h:mm a')}
      </p>
    </div>
  )
}

export default function Attendance() {
  const { isAr, t, lang } = useLang()
  const { services, people, currentUser } = useStore()
  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin

  const [tab,          setTab]          = useState(isAdmin ? 'sessions' : 'checkin')
  const [sessions,     setSessions]     = useState([])
  const [records,      setRecords]      = useState({})
  const [showCreate,   setShowCreate]   = useState(false)
  const [showQR,       setShowQR]       = useState(null)
  const [lateMins,     setLateMins]     = useState(15)
  const [excuseLimit,  setExcuseLimit]  = useState(3)
  const [excusePeriod, setExcusePeriod] = useState('monthly')
  const BLANK_CREATE = { name:'', label:'Service', sessionTime:'', serviceId:'', maxAttendees:'', repeatable:false, repeatFreq:'weekly' }
  const [createForm,   setCreateForm]   = useState(BLANK_CREATE)

  const PERIODS = isAr ? PERIODS_AR : PERIODS_EN

  const addSession = (form) => {
    const svc  = form.serviceId ? services.find(s => s.id === form.serviceId) : null
    const sess = {
      id:           'sess_' + Date.now(),
      name:         form.name || (svc ? svc.title : (SESSION_LABEL[lang]?.[form.label] || form.label)),
      service_id:   form.serviceId || null,
      service:      svc || null,
      label:        form.label,
      session_time: form.sessionTime || svc?.time || '',
      max_attendees:form.maxAttendees ? Number(form.maxAttendees) : null,
      repeatable:   form.repeatable,
      repeat_freq:  form.repeatFreq,
      qr_code:      makeToken(),
      active:       true,
      created_at:   new Date().toISOString(),
    }
    setSessions(prev => [sess, ...prev])
    setRecords(r  => ({ ...r, [sess.id]: [] }))
    return sess
  }
  const checkIn      = (sId, pId) => setRecords(r => { if ((r[sId]||[]).find(x=>x.person_id===pId)) return r; return {...r,[sId]:[...(r[sId]||[]),{id:'rec_'+Date.now(),session_id:sId,person_id:pId,check_in_at:new Date().toISOString(),check_out_at:null}]}})
  const checkOut     = (sId, pId) => setRecords(r => ({...r,[sId]:(r[sId]||[]).map(x=>x.person_id===pId?{...x,check_out_at:new Date().toISOString()}:x)}))
  const closeSession = (sId) => setSessions(p => p.map(s=>s.id===sId?{...s,active:false}:s))
  const deleteSession= (sId) => { setSessions(p=>p.filter(s=>s.id!==sId)); setRecords(r=>{const n={...r};delete n[sId];return n}) }
  const myRecord     = (sId) => (records[sId]||[]).find(r=>r.person_id===currentUser?.id)
  const presentCount = (sId) => (records[sId]||[]).filter(r=>r.check_in_at).length
  const teamCount    = (sId) => sessions.find(s=>s.id===sId)?.service?.team?.length||0
  const excuseCount  = (personId) => services.filter(s=>s.team.find(tm=>tm.personId===personId&&tm.status==='declined')).length
  const attendancePct= (personId) => { if (!sessions.length) return 0; const att=Object.entries(records).filter(([sId,recs])=>sessions.find(s=>s.id===sId)&&recs.find(r=>r.person_id===personId&&r.check_in_at)).length; return Math.round((att/sessions.length)*100) }
  const activeSessions = sessions.filter(s=>s.active)

  const handleCreate = () => {
    if (!createForm.label) return
    const sess = addSession(createForm)
    if (sess) {
      setShowCreate(false)
      setCreateForm(BLANK_CREATE)
      setTimeout(() => setShowQR(sess), 100)
    }
  }

  const ADMIN_TABS = [
    { label:t('sessions'), value:'sessions' },
    { label:t('records'),  value:'records'  },
    { label:t('attendanceReport'), value:'report' },
  ]
  const MEMBER_TABS = [
    { label:t('checkIn'),  value:'checkin'  },
    { label:t('history'),  value:'history'  },
  ]

  return (
    <div className="max-w-5xl space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs tabs={isAdmin ? ADMIN_TABS : MEMBER_TABS} active={tab} onChange={setTab}/>
        <div className="flex items-center gap-2">
          {isAdmin && <ExcuseLimitEditor lateMins={lateMins} onLateMins={setLateMins} excuseLimit={excuseLimit} excusePeriod={excusePeriod} onExcuseLimit={setExcuseLimit} onExcusePeriod={setExcusePeriod} t={t} isAr={isAr}/>}
          {isAdmin && <Btn onClick={() => setShowCreate(true)} icon={<Plus size={16}/>}>{t('newSession')}</Btn>}
        </div>
      </div>

      {/* Sessions tab */}
      {tab==='sessions' && isAdmin && (
        <div className="space-y-3">
          {sessions.length===0 && (
            <Card className="p-10 text-center">
              <QrCode size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm mb-3">{t('noSessions')}</p>
              <Btn onClick={()=>setShowCreate(true)} icon={<Plus size={16}/>}>{t('createSession')}</Btn>
            </Card>
          )}
          {sessions.map(sess => {
            const st = getSession(sess.label)
            const stLabel = SESSION_LABEL[lang]?.[sess.label] || sess.label
            const p  = presentCount(sess.id)
            const tc = teamCount(sess.id)
            return (
              <Card key={sess.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${st.color}`}>{st.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-slate-800">{sess.name || sess.service?.title || sess.label}</span>
                      <Badge color={sess.active?'green':'slate'} size="xs">{stLabel}</Badge>
                      {!sess.active && <Badge color="red" size="xs">{isAr ? 'مغلق' : 'Closed'}</Badge>}
                      {sess.repeatable && <Badge color="purple" size="xs">🔁 {isAr ? 'متكرر' : 'Repeat'}</Badge>}
                      {sess.max_attendees && <Badge color="amber" size="xs">max {sess.max_attendees}</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">
                      {sess.service?.date} · {sess.session_time} · {formatDistanceToNow(new Date(sess.created_at), {addSuffix:true, locale: isAr ? arLocale : undefined})}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-emerald-600 font-medium">{p} {isAr ? 'حضور' : 'present'}</span>
                      {tc>0 && <span className="text-sm text-slate-400">{isAr?'من':'of'} {tc}</span>}
                      {p>0 && tc>0 && <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-32"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${Math.round((p/tc)*100)}%`}}/></div>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={()=>setShowQR(sess)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-indigo-700">
                      <QrCode size={13}/> QR
                    </button>
                    {sess.active && <button onClick={()=>closeSession(sess.id)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg cursor-pointer" title={t('close')}><X size={15}/></button>}
                    <button onClick={()=>deleteSession(sess.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">🗑</button>
                  </div>
                </div>
                {(records[sess.id]||[]).length>0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {(records[sess.id]||[]).map(rec => {
                      const p2  = people.find(pp=>pp.id===rec.person_id)
                      if (!p2) return null
                      const mins = rec.check_in_at && sess.session_time ? differenceInMinutes(new Date(rec.check_in_at), new Date(`${sess.service?.date||new Date().toISOString().slice(0,10)}T${sess.session_time}`)) : 0
                      const late = mins > lateMins
                      return (
                        <div key={rec.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${late?'bg-amber-50 text-amber-700 border border-amber-200':'bg-emerald-50 text-emerald-700'}`}>
                          <CheckCircle size={10}/>{p2.name.split(' ')[0]}
                          {late && <span className="text-amber-500">+{mins}{isAr?'د':'m'}</span>}
                          {rec.check_out_at && <span className="opacity-60">{isAr?'خرج':'out'}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Member check-in */}
      {tab==='checkin' && !isAdmin && (
        <div className="space-y-4 max-w-md mx-auto">
          {activeSessions.length===0 ? (
            <Card className="p-10 text-center">
              <QrCode size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm">{t('noActiveSessions')}</p>
              <p className="text-xs text-slate-400 mt-1">{isAr ? 'انتظر حتى يفتح المسؤول جلسة حضور' : 'Wait for admin to open a session'}</p>
            </Card>
          ) : activeSessions.map(sess => {
            const st = getSession(sess.label)
            const stLabel = SESSION_LABEL[lang]?.[sess.label] || sess.label
            return (
              <Card key={sess.id} className="p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${st.color}`}>{st.icon}</div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{sess.name || sess.service?.title || sess.label}</h3>
                    <p className="text-sm text-slate-500">{stLabel} · {sess.service?.date} · {sess.session_time}</p>
                  </div>
                  <Badge color="green" size="sm" className="ms-auto">{isAr?'نشط':'Active'}</Badge>
                </div>
                <CheckInWidget session={sess} record={myRecord(sess.id)} lateMins={lateMins} t={t} isAr={isAr}
                  onCheckIn={()=>checkIn(sess.id, currentUser.id)}
                  onCheckOut={()=>checkOut(sess.id, currentUser.id)}/>
              </Card>
            )
          })}
        </div>
      )}

      {/* Records tab */}
      {tab==='records' && isAdmin && (
        <div className="space-y-4">
          {sessions.length===0 && <p className="text-slate-400 text-sm text-center py-8">{t('noSessions')}</p>}
          {sessions.map(sess => {
            const st = getSession(sess.label)
            const stLabel = SESSION_LABEL[lang]?.[sess.label] || sess.label
            return (
              <Card key={sess.id} className="overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{st.icon}</span>
                    <span className="font-semibold text-slate-700">{sess.name || sess.service?.title || sess.label}</span>
                    <Badge color="slate" size="xs">{stLabel}</Badge>
                    <span className="text-xs text-slate-400">{sess.service?.date}</span>
                  </div>
                  <span className="text-xs text-slate-400">{(records[sess.id]||[]).length} {isAr?'سجل':'records'}</span>
                </div>
                {(records[sess.id]||[]).length===0
                  ? <div className="p-6 text-center text-slate-400 text-sm">{isAr?'لا يوجد حضور بعد':'No attendance yet'}</div>
                  : (
                    <div className="divide-y divide-slate-50">
                      {(records[sess.id]||[]).map(rec => {
                        const p2 = people.find(pp=>pp.id===rec.person_id)
                        const mins = rec.check_in_at && sess.session_time ? differenceInMinutes(new Date(rec.check_in_at),new Date(`${sess.service?.date||new Date().toISOString().slice(0,10)}T${sess.session_time}`)) : 0
                        const lateStatus = mins<=0 ? 'on_time' : mins<=lateMins ? 'acceptable' : 'late'
                        const lateLabel  = isAr
                          ? (lateStatus==='on_time' ? 'في الوقت' : lateStatus==='acceptable' ? `متأخر ${mins}د (مقبول)` : `متأخر ${mins}د`)
                          : (lateStatus==='on_time' ? 'On Time'  : lateStatus==='acceptable' ? `${mins}m late (OK)`      : `${mins}m late`)
                        return (
                          <div key={rec.id} className="flex items-center gap-3 px-5 py-3">
                            <Avatar name={p2?.name||'?'} size="sm"/>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-800" dir="ltr">{p2?.name}</div>
                              <div className="text-xs text-slate-400">{p2?.role}</div>
                            </div>
                            <div className="text-xs text-right">
                              <div className="text-emerald-600">{isAr?'دخول':'In'}: {rec.check_in_at?format(new Date(rec.check_in_at),'h:mm a'):'—'}</div>
                              <div className="text-amber-500">{isAr?'خروج':'Out'}: {rec.check_out_at?format(new Date(rec.check_out_at),'h:mm a'):'—'}</div>
                            </div>
                            <Badge color={lateStatus==='on_time'?'green':lateStatus==='acceptable'?'yellow':'red'} size="xs">{lateLabel}</Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Report tab */}
      {tab==='report' && isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={isAr?'إجمالي الجلسات':'Total Sessions'}      value={sessions.length}                      icon={<QrCode size={20}/>}      color="indigo"/>
            <StatCard label={isAr?'إجمالي التسجيلات':'Total Records'}     value={Object.values(records).flat().length} icon={<CheckCircle size={20}/>}  color="green"/>
            <StatCard label={isAr?'جلسات نشطة':'Active Sessions'}          value={activeSessions.length}                icon={<RefreshCw size={20}/>}    color="blue"/>
            <StatCard label={isAr?'حد التأخير':'Late Limit'}               value={`${lateMins} ${isAr?'د':'m'}`}       icon={<Clock size={20}/>}        color="amber"/>
          </div>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-slate-800">{isAr?'نسبة الحضور':'Attendance Rate'}</h3>
              <span className="text-xs text-slate-500">{isAr?'حد الأعذار':'Excuse limit'}: <strong>{excuseLimit}</strong> {PERIODS[excusePeriod]}</span>
            </div>
            {people.filter(p=>p.status==='active').map(p => {
              const pct = attendancePct(p.id)
              const attended = Object.entries(records).filter(([sId,recs])=>recs.find(r=>r.person_id===p.id&&r.check_in_at)).length
              const excuses  = excuseCount(p.id)
              return (
                <div key={p.id} className="flex items-center gap-3 mb-3">
                  <Avatar name={p.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-slate-700 truncate" dir="ltr">{p.name}</span>
                      <div className="flex items-center gap-2 text-xs">
                        {excuses > excuseLimit && <Badge color="red" size="xs">{isAr?'أعذار':'Excuses'}: {excuses}</Badge>}
                        <span className="text-slate-400">{attended}/{sessions.length}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct>=80?'bg-emerald-500':pct>=50?'bg-amber-400':'bg-red-400'}`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${pct>=80?'text-emerald-600':pct>=50?'text-amber-500':'text-red-500'}`}>{pct}%</span>
                </div>
              )
            })}
          </Card>
          <Card className="p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4">{t('sessionType')}</h3>
            <div className="space-y-2">
              {SESSION_TYPES.map(st => {
                const cnt = sessions.filter(s=>s.label===st.key).length
                if (!cnt) return null
                return (
                  <div key={st.key} className="flex items-center gap-3">
                    <span className="text-xl w-8">{st.icon}</span>
                    <span className="text-sm text-slate-700 flex-1">{SESSION_LABEL[lang]?.[st.key]||st.key}</span>
                    <span className="text-sm font-medium text-slate-600">{cnt} {isAr?'جلسة':'sessions'}</span>
                  </div>
                )
              })}
              {sessions.length===0 && <p className="text-slate-400 text-sm">{t('noSessions')}</p>}
            </div>
          </Card>
        </div>
      )}

      {/* Member history */}
      {tab==='history' && !isAdmin && (
        <div className="space-y-3 max-w-md mx-auto">
          {Object.entries(records).flatMap(([sId,recs])=>recs.filter(r=>r.person_id===currentUser?.id).map(r=>{
            const sess = sessions.find(s=>s.id===sId)
            const st   = getSession(sess?.label)
            const stLabel = SESSION_LABEL[lang]?.[sess?.label] || sess?.label
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${st.color}`}>{st.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-800 text-sm">{sess?.service?.title || (isAr?'خدمة':'Service')}</div>
                    <div className="text-xs text-slate-500">{stLabel} · {sess?.service?.date}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-emerald-600">{isAr?'دخول':'In'}: {r.check_in_at?format(new Date(r.check_in_at),'h:mm a'):'—'}</div>
                    <div className="text-amber-500">{isAr?'خروج':'Out'}: {r.check_out_at?format(new Date(r.check_out_at),'h:mm a'):'—'}</div>
                  </div>
                </div>
              </Card>
            )
          }))}
          {Object.values(records).flat().filter(r=>r.person_id===currentUser?.id).length===0 && (
            <Card className="p-10 text-center">
              <Clock size={28} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm">{isAr?'لا يوجد سجل حضور بعد':'No attendance history yet'}</p>
            </Card>
          )}
        </div>
      )}

      {/* Create session modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}
        title={t('createSession')}
        size="md"
        footer={<>
          <Btn variant="secondary" onClick={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}>{t('cancel')}</Btn>
          <Btn onClick={handleCreate} disabled={!createForm.label}>{t('createAndQR')}</Btn>
        </>}>

        <div className="space-y-5">

          {/* Session name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isAr ? 'اسم الجلسة' : 'Session Name'}
              <span className="text-xs text-slate-400 font-normal ms-2">
                ({isAr ? 'اختياري — يُستخدم الاسم التلقائي إن تُرك فارغاً' : 'optional — auto-named from type if left blank'})
              </span>
            </label>
            <input
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder={isAr ? 'مثال: بروفة الإثنين، خدمة عيد الفصح...' : 'e.g. Monday Rehearsal, Easter Service...'}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"
              dir="auto"
            />
          </div>

          {/* Session type grid */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('sessionType')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SESSION_TYPES.map(st => (
                <button key={st.key} type="button"
                  onClick={() => setCreateForm(f => ({ ...f, label: st.key }))}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border cursor-pointer transition-all text-center ${
                    createForm.label === st.key
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <span className="text-2xl">{st.icon}</span>
                  <span className="text-xs font-medium leading-tight">{SESSION_LABEL[lang]?.[st.key] || st.key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Start time + max attendees */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('startTime')}
                <span className="text-xs text-slate-400 font-normal ms-1.5">
                  ({isAr ? 'لحساب التأخير' : 'for late tracking'})
                </span>
              </label>
              <input
                type="time"
                value={createForm.sessionTime}
                onChange={e => setCreateForm(f => ({ ...f, sessionTime: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {isAr ? 'الحد الأقصى للحضور' : 'Attendee Limit'}
                <span className="text-xs text-slate-400 font-normal ms-1.5">({t('optional')})</span>
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={createForm.maxAttendees}
                onChange={e => setCreateForm(f => ({ ...f, maxAttendees: e.target.value }))}
                placeholder={isAr ? 'مثال: 30' : 'e.g. 30'}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"
              />
            </div>
          </div>

          {/* Optional service link */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {isAr ? 'ربط بخدمة (اختياري)' : 'Link to Service (optional)'}
            </label>
            <select
              value={createForm.serviceId}
              onChange={e => setCreateForm(f => ({ ...f, serviceId: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white hover:border-slate-300">
              <option value="">{isAr ? '— بدون ربط بخدمة —' : '— No linked service —'}</option>
              {services.filter(s => s.status !== 'completed').map(s => (
                <option key={s.id} value={s.id}>{s.title} — {s.date}</option>
              ))}
            </select>
          </div>

          {/* Repeatable toggle */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-700">
                  {isAr ? 'جلسة متكررة' : 'Repeatable Session'}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isAr ? 'أنشئ QR واحد يُستخدم في كل مرة' : 'One QR code reused each time'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateForm(f => ({ ...f, repeatable: !f.repeatable }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  createForm.repeatable ? 'bg-indigo-600' : 'bg-slate-200'
                }`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  createForm.repeatable ? 'translate-x-6' : 'translate-x-1'
                }`}/>
              </button>
            </label>

            {createForm.repeatable && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium text-slate-500 mb-2">
                  {isAr ? 'التكرار' : 'Frequency'}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    ['daily',    isAr ? 'يومياً'    : 'Daily'    ],
                    ['weekly',   isAr ? 'أسبوعياً'  : 'Weekly'   ],
                    ['monthly',  isAr ? 'شهرياً'    : 'Monthly'  ],
                  ].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setCreateForm(f => ({ ...f, repeatFreq: val }))}
                      className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                        createForm.repeatFreq === val
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-slate-200 text-slate-500 hover:border-indigo-300'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings preview */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <Clock size={13} className="flex-shrink-0"/>
            <span>
              {isAr ? 'حد التأخير' : 'Late limit'}: <strong>{lateMins} {isAr ? 'دقيقة' : 'min'}</strong>
              {' · '}
              {isAr ? 'حد الأعذار' : 'Excuse limit'}: <strong>{excuseLimit}</strong> {PERIODS[excusePeriod]}
              {createForm.maxAttendees && (
                <> · {isAr ? 'الحد الأقصى' : 'Max'}: <strong>{createForm.maxAttendees}</strong></>
              )}
              {createForm.repeatable && (
                <> · 🔁 {isAr ? `يتكرر ${createForm.repeatFreq === 'daily' ? 'يومياً' : createForm.repeatFreq === 'weekly' ? 'أسبوعياً' : 'شهرياً'}` : `Repeats ${createForm.repeatFreq}`}</>
              )}
            </span>
          </div>
        </div>
      </Modal>

      <QRModal open={!!showQR} onClose={()=>setShowQR(null)} session={showQR} service={showQR?.service} t={t} isAr={isAr} lang={lang}/>
    </div>
  )
}
