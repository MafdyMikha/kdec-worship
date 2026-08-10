import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, CheckCircle, Clock, X, Plus, Printer, RefreshCw, CheckCheck, ChevronDown, Calendar } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { isAdminUser } from '../lib/permissions.js'
import { Card, Btn, Badge, Avatar, Modal, StatCard, Tabs, Input, Select } from '../components/ui'
import { KDEC_LOGO } from '../assets/kdecLogo.js'
import { attendanceOccurrenceDate, dateKeyInTimezone } from '../lib/attendance.js'

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
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))

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

function QRModal({ open, onClose, session, service, occurrenceDateLabel, t, isAr, lang }) {
  const qrRef = useRef(null)
  if (!session) return null
  const url = `${window.location.origin}/checkin/${session.qr_code}`
  const st  = getSession(session.label)
  const stLabel = SESSION_LABEL[lang]?.[session.label] || session.label

  const handlePrint = () => {
    const win = window.open('','_blank')
    if (!win) return
    win.document.write(`<html><head><title>QR</title>
    <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:Arial,sans-serif;background:#f8fafc;gap:10px}
    h1{font-size:20px;font-weight:700;margin:0} p{color:#64748b;font-size:13px;margin:2px 0}
    .badge{background:#ede9fe;color:#7c3aed;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700}
    .qr{background:white;padding:20px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);margin:12px 0}
    </style></head><body>
    <img src="${KDEC_LOGO}" style="width:50px;border-radius:8px"/>
    <h1>${escapeHtml(service?.title || 'KDEC Worship')}</h1>
    <p>${escapeHtml(occurrenceDateLabel || service?.date)} · ${escapeHtml(session.session_time)}</p>
    <div class="badge">${escapeHtml(st.icon)} ${escapeHtml(stLabel)}</div>
    <div class="qr">${qrRef.current?.innerHTML||''}</div>
    <p style="font-size:12px;color:#94a3b8">${isAr ? 'امسح لتسجيل الحضور' : 'Scan to check in'}</p>
    </body></html>`)
    win.document.close(); win.print()
  }

  return (
    <Modal open={open} onClose={onClose} title={`QR — ${stLabel}`} size="sm"
      footer={<><Btn variant="secondary" onClick={onClose}>{t('close')}</Btn><Btn onClick={handlePrint} icon={<Printer size={14}/>}>{t('print')}</Btn></>}>
      <div className="text-center space-y-4">
        <div className="text-sm text-slate-500">{service?.title} · {occurrenceDateLabel || service?.date}</div>
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

function CheckInWidget({ record, lateMins, onCheckIn, onCheckOut, t, isAr }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const doAction = async (type) => {
    setLoading(true)
    setError('')
    const result = await (type==='in' ? onCheckIn() : onCheckOut())
    if (result?.error) setError(result.error)
    setLoading(false)
  }
  const getLate = () => {
    if (!record?.check_in_at) return null
    if (record.status === 'late') return { label:isAr?`متأخر (أكثر من ${lateMins} دقيقة)`:`Late (over ${lateMins}m)`, cls:'bg-red-100 text-red-700' }
    return { label:isAr?'حاضر ضمن الوقت المسموح ✓':'Present within tolerance ✓', cls:'bg-emerald-100 text-emerald-700' }
  }

  if (!record?.check_in_at) return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto"><QrCode size={28} className="text-indigo-500"/></div>
      <div><p className="font-semibold text-slate-700">{isAr ? 'سجّل حضورك' : 'Check In'}</p><p className="text-xs text-slate-400 mt-1">{isAr ? 'امسح كود QR أو اضغط الزر' : 'Scan QR code or tap button'}</p></div>
      {error&&<p className="text-sm text-red-600" role="alert">{error}</p>}
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
        {error&&<p className="text-sm text-red-600" role="alert">{error}</p>}
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
  const { token:routeToken } = useParams()
  const {
    services, people, currentUser, attendanceSessions:sessions, attendanceRecords:records,
    excuseRequests,
    organizationSettings, updateOrganizationSettings,
    createAttendanceSession, closeAttendanceSession,
    resolveAttendanceSession, checkInAttendance, checkOutAttendance,
  } = useStore()
  const isAdmin = isAdminUser(currentUser)

  const [tab,          setTab]          = useState(routeToken ? 'checkin' : (isAdmin ? 'sessions' : 'checkin'))
  const [showCreate,   setShowCreate]   = useState(false)
  const [showQR,       setShowQR]       = useState(null)
  const [resolvedSession, setResolvedSession] = useState(null)
  const [resolveError, setResolveError] = useState('')
  const lateMins = organizationSettings.attendanceLateMinutes
  const excuseLimit = organizationSettings.excuseLimit
  const excusePeriod = organizationSettings.excusePeriod
  const setLateMins = update => {
    const value = typeof update==='function' ? update(lateMins) : update
    void updateOrganizationSettings({ attendanceLateMinutes:value })
  }
  const setExcuseLimit = update => {
    const value = typeof update==='function' ? update(excuseLimit) : update
    void updateOrganizationSettings({ excuseLimit:value })
  }
  const setExcusePeriod = value => { void updateOrganizationSettings({ excusePeriod:value }) }
  const BLANK_CREATE = { name:'', label:'Service', sessionTime:'', serviceId:'', maxAttendees:'', repeatable:false, repeatFreq:'weekly' }
  const [createForm,   setCreateForm]   = useState(BLANK_CREATE)
  useEffect(() => {
    if (!routeToken) return undefined
    let active = true
    void resolveAttendanceSession(routeToken).then(result => {
      if (!active) return
      if (result.error) { setResolveError(result.error); setResolvedSession(null) }
      else { setResolvedSession(result.data); setResolveError('') }
    })
    return () => { active=false }
  }, [resolveAttendanceSession, routeToken])

  const PERIODS = isAr ? PERIODS_AR : PERIODS_EN

  const occurrenceDate = session => attendanceOccurrenceDate(session, organizationSettings.timezone)
  const occurrenceRecords = session => (records[session.id]||[]).filter(record => record.occurrence_date===occurrenceDate(session))
  const myRecord = session => occurrenceRecords(session).find(record => record.person_id===currentUser?.id)
  const presentCount = session => occurrenceRecords(session).filter(record => record.check_in_at).length
  const teamCount = session => services.find(service => service.id===(session.serviceId||session.service_id))?.team?.length||0
  const excuseCount = personId => {
    const periodStart = excusePeriod === 'total'
      ? null
      : attendanceOccurrenceDate({ repeatable:true, repeatFreq:excusePeriod==='weekly'?'weekly':'monthly' }, organizationSettings.timezone)
    return excuseRequests.filter(request => {
      if (request.person_id!==personId || !['pending','approved'].includes(request.status)) return false
      return !periodStart || dateKeyInTimezone(new Date(request.created_at), organizationSettings.timezone) >= periodStart
    }).length
  }
  const attendanceStats = personId => {
    const occurrenceKeys = new Set()
    const attendedKeys = new Set()
    sessions.forEach(session => {
      const sessionRecords = records[session.id]||[]
      sessionRecords.forEach(record => {
        const key = `${session.id}:${record.occurrence_date}`
        occurrenceKeys.add(key)
        if (record.person_id===personId && record.check_in_at) attendedKeys.add(key)
      })
      if (session.active) occurrenceKeys.add(`${session.id}:${occurrenceDate(session)}`)
    })
    const total = occurrenceKeys.size
    const attended = attendedKeys.size
    return { attended, total, pct:total ? Math.round((attended/total)*100) : 0 }
  }
  const activeSessions = routeToken ? (resolvedSession?[resolvedSession]:[]) : sessions.filter(s=>s.active)

  const handleCreate = async () => {
    if (!createForm.label) return
    const result = await createAttendanceSession(createForm)
    if (result?.data) {
      setShowCreate(false)
      setCreateForm(BLANK_CREATE)
      setShowQR(result.data)
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
        <Tabs tabs={isAdmin&&!routeToken ? ADMIN_TABS : MEMBER_TABS} active={tab} onChange={setTab}/>
        <div className="flex items-center gap-2">
          {isAdmin&&!routeToken && <ExcuseLimitEditor lateMins={lateMins} onLateMins={setLateMins} excuseLimit={excuseLimit} excusePeriod={excusePeriod} onExcuseLimit={setExcuseLimit} onExcusePeriod={setExcusePeriod} t={t} isAr={isAr}/>}
          {isAdmin&&!routeToken && <Btn onClick={() => setShowCreate(true)} icon={<Plus size={16}/>}>{t('newSession')}</Btn>}
        </div>
      </div>

      {/* Sessions tab */}
      {tab==='sessions' && isAdmin && !routeToken && (
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
            const currentOccurrenceDate = occurrenceDate(sess)
            const currentRecords = occurrenceRecords(sess)
            const p  = presentCount(sess)
            const tc = teamCount(sess)
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
                      {currentOccurrenceDate} · {sess.session_time} · {formatDistanceToNow(new Date(sess.created_at), {addSuffix:true, locale: isAr ? arLocale : undefined})}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-emerald-600 font-medium">{p} {isAr ? 'حضور' : 'present'}</span>
                      {tc>0 && <span className="text-sm text-slate-400">{isAr?'من':'of'} {tc}</span>}
                      {p>0 && tc>0 && <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-32"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${Math.round((p/tc)*100)}%`}}/></div>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={()=>setShowQR(sess)} aria-label={isAr?'عرض رمز الحضور':'Show attendance QR code'} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-indigo-700">
                      <QrCode size={13}/> QR
                    </button>
                    {sess.active && <button onClick={()=>closeAttendanceSession(sess.id)} aria-label={isAr?'إغلاق جلسة الحضور':'Close attendance session'} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg cursor-pointer" title={t('close')}><X size={15}/></button>}
                  </div>
                </div>
                {currentRecords.length>0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {currentRecords.map(rec => {
                      const p2  = people.find(pp=>pp.id===rec.person_id)
                      if (!p2) return null
                      const late = rec.status === 'late'
                      return (
                        <div key={rec.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${late?'bg-amber-50 text-amber-700 border border-amber-200':'bg-emerald-50 text-emerald-700'}`}>
                          <CheckCircle size={10}/>{p2.name.split(' ')[0]}
                          {late && <span className="text-amber-500">{isAr?'متأخر':'late'}</span>}
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
      {tab==='checkin' && (!isAdmin || !!routeToken) && (
        <div className="space-y-4 max-w-md mx-auto">
          {activeSessions.length===0 ? (
            <Card className="p-10 text-center">
              <QrCode size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className={`text-sm ${resolveError?'text-red-600':'text-slate-500'}`} role={resolveError?'alert':undefined}>{resolveError||t('noActiveSessions')}</p>
              {!resolveError&&<p className="text-xs text-slate-400 mt-1">{isAr ? 'امسح رمز الحضور الذي شاركه المسؤول' : 'Scan the attendance code shared by an admin'}</p>}
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
                    <p className="text-sm text-slate-500">{stLabel} · {occurrenceDate(sess)} · {sess.session_time}</p>
                  </div>
                  <Badge color="green" size="sm" className="ms-auto">{isAr?'نشط':'Active'}</Badge>
                </div>
                <CheckInWidget record={myRecord(sess)} lateMins={lateMins} t={t} isAr={isAr}
                  onCheckIn={()=>checkInAttendance(sess.qr_code)}
                  onCheckOut={()=>checkOutAttendance(sess.id)}/>
              </Card>
            )
          })}
        </div>
      )}

      {/* Records tab */}
      {tab==='records' && isAdmin && !routeToken && (
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
                        const lateStatus = rec.status==='late' ? 'late' : 'on_time'
                        const lateLabel  = rec.status==='late' ? (isAr?'متأخر':'Late') : (isAr?'ضمن الوقت المسموح':'Within tolerance')
                        return (
                          <div key={rec.id} className="flex items-center gap-3 px-5 py-3">
                            <Avatar name={p2?.name||'?'} size="sm"/>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-800" dir="auto">{p2?.name}</div>
                              <div className="text-xs text-slate-400">{p2?.role} · {rec.occurrence_date || sess.service?.date || '—'}</div>
                            </div>
                            <div className="text-xs text-right">
                              <div className="text-emerald-600">{isAr?'دخول':'In'}: {rec.check_in_at?format(new Date(rec.check_in_at),'h:mm a'):'—'}</div>
                              <div className="text-amber-500">{isAr?'خروج':'Out'}: {rec.check_out_at?format(new Date(rec.check_out_at),'h:mm a'):'—'}</div>
                            </div>
                            <Badge color={lateStatus==='on_time'?'green':'red'} size="xs">{lateLabel}</Badge>
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
      {tab==='report' && isAdmin && !routeToken && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              const { pct, attended, total } = attendanceStats(p.id)
              const excuses  = excuseCount(p.id)
              return (
                <div key={p.id} className="flex items-center gap-3 mb-3">
                  <Avatar name={p.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-slate-700 truncate" dir="auto">{p.name}</span>
                      <div className="flex items-center gap-2 text-xs">
                        {excuses > excuseLimit && <Badge color="red" size="xs">{isAr?'أعذار':'Excuses'}: {excuses}</Badge>}
                        <span className="text-slate-400">{attended}/{total}</span>
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
      {tab==='history' && (!isAdmin || !!routeToken) && (
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
                    <div className="text-xs text-slate-500">{stLabel} · {r.occurrence_date || sess?.service?.date || '—'}</div>
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
        open={isAdmin&&showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}
        title={t('createSession')}
        size="md"
        footer={<>
          <Btn variant="secondary" onClick={() => { setShowCreate(false); setCreateForm(BLANK_CREATE) }}>{t('cancel')}</Btn>
          <Btn onClick={handleCreate} disabled={!createForm.label}>{t('createAndQR')}</Btn>
        </>}>

        <div className="space-y-5">

          {/* Session name */}
          <Input label={isAr?'اسم الجلسة (اختياري)':'Session Name (optional)'} value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name:e.target.value }))}
            placeholder={isAr?'مثال: بروفة الإثنين، خدمة عيد الفصح...':'e.g. Monday Rehearsal, Easter Service...'} dir="auto"/>

          {/* Session type grid */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('sessionType')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2" role="radiogroup" aria-label={t('sessionType')}>
              {SESSION_TYPES.map(st => (
                <button key={st.key} type="button" role="radio" aria-checked={createForm.label===st.key}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={`${t('startTime')} (${isAr?'لحساب التأخير':'for late tracking'})`} type="time" value={createForm.sessionTime}
              onChange={e => setCreateForm(f => ({ ...f, sessionTime:e.target.value }))}/>
            <Input label={`${isAr?'الحد الأقصى للحضور':'Attendee Limit'} (${t('optional')})`} type="number" min="1" max="500"
              value={createForm.maxAttendees} onChange={e => setCreateForm(f => ({ ...f, maxAttendees:e.target.value }))}
              placeholder={isAr?'مثال: 30':'e.g. 30'}/>
          </div>

          {/* Optional service link */}
          <Select label={isAr?'ربط بخدمة (اختياري)':'Link to Service (optional)'} value={createForm.serviceId}
              onChange={e => setCreateForm(f => ({ ...f, serviceId:e.target.value }))}>
              <option value="">{isAr ? '— بدون ربط بخدمة —' : '— No linked service —'}</option>
              {services.filter(s => !['completed','cancelled'].includes(s.status) && s.date>=format(new Date(),'yyyy-MM-dd')).map(s => (
                <option key={s.id} value={s.id}>{s.title} — {s.date}</option>
              ))}
          </Select>

          {/* Repeatable toggle */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
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
                role="switch"
                aria-checked={createForm.repeatable}
                aria-label={isAr?'جلسة متكررة':'Repeatable session'}
                onClick={() => setCreateForm(f => ({ ...f, repeatable: !f.repeatable }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  createForm.repeatable ? 'bg-indigo-600' : 'bg-slate-200'
                }`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  createForm.repeatable ? 'translate-x-6' : 'translate-x-1'
                }`}/>
              </button>
            </div>

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

      <QRModal open={!!showQR} onClose={()=>setShowQR(null)} session={showQR} service={showQR?.service}
        occurrenceDateLabel={showQR ? occurrenceDate(showQR) : ''} t={t} isAr={isAr} lang={lang}/>
    </div>
  )
}
