import { Calendar, Music2, Users, CheckCircle, Clock, AlertCircle, ArrowRight, Star, QrCode, Megaphone } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, StatCard, Badge, Avatar, Btn, StatusDot } from '../components/ui'
import { format, parseISO, isAfter, addDays } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { KDEC_LOGO } from '../assets/kdecLogo.js'

export default function Dashboard() {
  const { services, songs, people, announcements } = useStore()
  const { t, lang, isAr } = useLang()
  const navigate  = useNavigate()
  const today     = new Date()
  const locale    = isAr ? arLocale : undefined

  const upcoming = services
    .filter(s => s.status !== 'completed' && isAfter(parseISO(s.date), addDays(today,-1)))
    .sort((a,b) => parseISO(a.date) - parseISO(b.date)).slice(0, 3)

  const nextSvc       = upcoming[0]
  const activePeople  = people.filter(p => p.status === 'active').length
  const pendingTotal  = services.flatMap(s => s.team.filter(t => t.status === 'pending')).length
  const topSongs      = [...songs].sort((a,b) => (b.usageCount||0)-(a.usageCount||0)).slice(0, 5)

  const STATUS_LABEL = { confirmed: t('confirmed'), pending: t('pending'), declined: t('declined') }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-6 text-white relative overflow-hidden">
        {/* Background watermark logo — always at the physical right edge, behind text */}
        <img src={KDEC_LOGO} alt="" className="absolute right-6 top-1/2 -translate-y-1/2 w-24 h-24 object-contain opacity-10 pointer-events-none select-none" style={{zIndex:0}}/>
        <div className="relative" style={{zIndex:1}}>
          <div className="text-indigo-200 text-sm mb-1">
            {isAr ? format(today,'EEEE، d MMMM yyyy',{locale:arLocale}) : format(today,'EEEE, MMMM d, yyyy')}
          </div>
          <h2 className="font-display text-2xl font-bold mb-1">{t('welcomeBack')}</h2>
          <p className="text-indigo-200 text-sm">
            {nextSvc
              ? `${t('nextService')}: ${nextSvc.title} · ${format(parseISO(nextSvc.date),'d MMM',{locale})} ${t('at')} ${nextSvc.time}`
              : (isAr?t('noUpcoming'):t('noUpcoming'))}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('activeMembers')}   value={activePeople}    icon={<Users size={20}/>}       color="indigo"/>
        <StatCard label={t('songLibrary')}      value={songs.length}    icon={<Music2 size={20}/>}      color="purple"/>
        <StatCard label={t('upcomingServices')} value={upcoming.length} icon={<Calendar size={20}/>}    color="blue"/>
        <StatCard label={t('pendingResponses')}      value={pendingTotal}    icon={<AlertCircle size={20}/>} color="amber"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 md:grid-cols-3 gap-6">
        {/* Upcoming list */}
        <div className="col-span-2 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-800">{t('upcomingServices')}</h3>
            <button onClick={() => navigate('/services')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
              {t('viewAll')} <ArrowRight size={14}/>
            </button>
          </div>

          {upcoming.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm mb-3">{t('noUpcoming')}</p>
              <Btn variant="outline" size="sm" onClick={() => navigate('/services')}>{t('createService')}</Btn>
            </Card>
          ) : upcoming.map((svc,i) => {
            const conf = svc.team.filter(t=>t.status==='confirmed').length
            const pend = svc.team.filter(t=>t.status==='pending').length
            return (
              <Card key={svc.id} hover onClick={() => navigate(`/services/${svc.id}`)} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 text-center bg-slate-50 rounded-xl py-2">
                    <div className="text-xs font-medium text-slate-400">{format(parseISO(svc.date),'MMM',{locale})}</div>
                    <div className="text-2xl font-display font-bold text-slate-800">{format(parseISO(svc.date),'d')}</div>
                    <div className="text-xs text-slate-400">{format(parseISO(svc.date),isAr?'EEE':'EEE',{locale})}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {i === 0 && <Badge color="indigo" size="xs">{isAr?'القادم':'Next Up'}</Badge>}
                      <Badge color="blue" size="xs">{svc.type}</Badge>
                    </div>
                    <h4 className="font-display font-semibold text-slate-800">{svc.title}</h4>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={12}/>{svc.time}</span>
                      <span className="flex items-center gap-1"><Music2 size={12}/>{svc.setlist.length} {isAr?'ترنيمة':'songs'}</span>
                      {conf>0&&<span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={12}/>{conf}</span>}
                      {pend>0&&<span className="text-amber-500">{pend} {isAr?'انتظار':'pending'}</span>}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-300 flex-shrink-0"/>
                </div>
              </Card>
            )
          })}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3">
            <Card hover onClick={() => navigate('/attendance')} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0"><QrCode size={18}/></div>
              <div>
                <div className="font-semibold text-slate-700 text-sm">{t('attendance')}</div>
                <div className="text-xs text-slate-400">{isAr?'تسجيل حضور QR':'QR check-in'}</div>
              </div>
            </Card>
            <Card hover onClick={() => navigate('/events')} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 flex-shrink-0"><Megaphone size={18}/></div>
              <div>
                <div className="font-semibold text-slate-700 text-sm">{t('events')}</div>
                <div className="text-xs text-slate-400">{isAr?'المؤتمرات والأنشطة':'Conferences & Events'}</div>
              </div>
            </Card>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-slate-800 text-sm">{t('topSongs')}</h3>
              <button onClick={() => navigate('/songs')} className="text-xs text-indigo-600 cursor-pointer hover:underline">{t('all')}</button>
            </div>
            {topSongs.length === 0 ? <p className="text-sm text-slate-400 py-3 text-center">{isAr?'لا توجد ترانيم':t('noSongs')}</p> :
            topSongs.map((song,i) => (
              <div key={song.id} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-slate-400 w-4 text-right">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate" dir="rtl">{song.title}</div>
                  <div className="text-xs text-slate-400">{song.key} · {song.usageCount||0}×</div>
                </div>
                {i === 0 && <Star size={12} className="text-amber-400 flex-shrink-0"/>}
              </div>
            ))}
          </Card>

          {nextSvc && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-slate-800 text-sm">{t('nextTeam')}</h3>
                <Badge color={nextSvc.team.filter(t=>t.status==='pending').length>0?'yellow':'green'} size="xs">
                  {nextSvc.team.filter(t=>t.status==='confirmed').length}/{nextSvc.team.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {nextSvc.team.slice(0,6).map(tm => {
                  const person = tm.person || people.find(p => p.id === tm.personId)
                  if (!person) return null
                  return (
                    <div key={tm.personId||tm.person?.id} className="flex items-center gap-2.5">
                      <Avatar name={person.name} size="xs"/>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-700 truncate">{person.name}</div>
                        <div className="text-xs text-slate-400">{tm.role}</div>
                      </div>
                      <StatusDot status={tm.status}/>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {announcements.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-slate-800 text-sm">{t('announcements')}</h3>
                <button onClick={() => navigate('/announcements')} className="text-xs text-indigo-600 cursor-pointer hover:underline">{t('all')}</button>
              </div>
              <div className="space-y-3">
                {announcements.slice(0,2).map(a => (
                  <div key={a.id} className={`border-r-2 border-indigo-300 ${isAr?'pr-3':'pl-3 border-r-0 border-l-2'}`}>
                    <div className="text-xs font-semibold text-slate-700">{a.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{a.content}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
