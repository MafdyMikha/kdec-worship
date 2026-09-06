import { Calendar, Music2, Users, CheckCircle, Clock, AlertCircle, ArrowRight, Star, QrCode, Megaphone } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, StatCard, Badge, Avatar, Btn, StatusDot } from '../components/ui'
import { format, parseISO } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import RehearsalReminder from '../components/RehearsalReminder'
import { hasPermission } from '../lib/permissions.js'

export default function Dashboard() {
  const { services, songs, people, announcements, currentUser } = useStore()
  const { t, isAr } = useLang()
  const navigate  = useNavigate()
  const today     = new Date()
  const locale    = isAr ? arLocale : undefined

  const upcoming = services
    .filter(s => !['completed','cancelled'].includes(s.status) && s.date >= format(today,'yyyy-MM-dd'))
    .sort((a,b) => parseISO(a.date) - parseISO(b.date)).slice(0, 3)

  const nextSvc       = upcoming[0]
  const activeSongs   = songs.filter(s => s.status !== 'inactive')
  const activePeople  = people.filter(p => p.status === 'active').length
  const pendingTotal  = services.filter(s => s.status !== 'cancelled').flatMap(s => s.team.filter(t => t.status === 'pending')).length
  const topSongs      = [...activeSongs].sort((a,b) => (b.usageCount||0)-(a.usageCount||0)).slice(0, 5)

  const STATUS_LABEL = { confirmed: t('confirmed'), pending: t('pending'), declined: t('declined') }

  return (
    <div className="space-y-6 max-w-7xl animate-fade-in">
      <div className="worship-page-heading">
        <div><h1>{isAr ? `أهلاً، ${currentUser?.name?.split(' ')[0] || ''}` : `Welcome, ${currentUser?.name?.split(' ')[0] || ''}`}</h1>
          <p>{isAr ? 'أسبوع جديد وقلب واحد. لنستعد معًا.' : 'A new week. One heart. Let’s prepare together.'}</p></div>
        {hasPermission(currentUser,'services.create') && <Btn onClick={()=>navigate('/services')} icon={<Calendar size={16}/>}>{isAr ? 'تخطيط خدمة' : 'Plan a service'}</Btn>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="worship-next-service xl:col-span-2">
          <p className="worship-eyebrow">{isAr ? 'الخدمة القادمة' : 'Your next service'}</p>
          {nextSvc ? <>
            <h2 dir="auto">{nextSvc.title}</h2>
            <p className="text-slate-500 mt-2">{format(parseISO(nextSvc.date),'EEEE, d MMMM',{locale})} · <bdi>{nextSvc.time}</bdi></p>
            <hr/>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div><div className="flex gap-1 mb-2">{nextSvc.team.slice(0,5).map(tm=><Avatar key={tm.personId} name={(tm.person || people.find(p=>p.id===tm.personId))?.name} size="sm"/>)}</div>
                <p className="text-sm text-slate-500">{nextSvc.team.filter(tm=>tm.status==='confirmed').length} {t('confirmed')} · {nextSvc.team.filter(tm=>tm.status==='pending').length} {t('pending')}</p>
              </div>
              <Btn onClick={()=>navigate(`/services/${nextSvc.id}`)}>{isAr?'عرض الخدمة':'Open service'}<ArrowRight size={16} className={isAr?'rotate-180':''}/></Btn>
            </div>
          </> : <><h2>{t('noUpcoming')}</h2><p className="text-slate-500 mt-3">{isAr?'ستظهر خطط الفريق هنا عند إضافة خدمة.':'Your team’s plans will appear here when a service is added.'}</p></>}
        </section>
        <RehearsalReminder services={services}/>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t('activeMembers')}   value={activePeople}    icon={<Users size={20}/>}       color="indigo"/>
        <StatCard label={t('songLibrary')}      value={activeSongs.length} icon={<Music2 size={20}/>}   color="purple"/>
        <StatCard label={t('upcomingServices')} value={upcoming.length} icon={<Calendar size={20}/>}    color="blue"/>
        <StatCard label={t('pendingResponses')}      value={pendingTotal}    icon={<AlertCircle size={20}/>} color="amber"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming list */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-slate-800">{t('upcomingServices')}</h3>
            <button onClick={() => navigate('/services')}
              aria-label={isAr ? 'عرض كل الخدمات القادمة' : 'View all upcoming services'}
              className="text-sm text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
              {t('viewAll')} <ArrowRight size={14} aria-hidden="true" className={isAr ? 'rotate-180' : ''}/>
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
                  <ArrowRight size={16} aria-hidden="true" className={`text-slate-300 flex-shrink-0 ${isAr ? 'rotate-180' : ''}`}/>
                </div>
              </Card>
            )
          })}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <button onClick={() => navigate('/songs')}
                aria-label={isAr ? 'عرض كل الترانيم' : 'View all songs'}
                className="text-xs text-indigo-600 cursor-pointer hover:underline">{t('all')}</button>
            </div>
            {topSongs.length === 0 ? <p className="text-sm text-slate-400 py-3 text-center">{isAr?'لا توجد ترانيم':t('noSongs')}</p> :
            topSongs.map((song,i) => (
              <div key={song.id} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-slate-400 w-4 text-end">{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate" dir="auto">{song.title}</div>
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
                <button onClick={() => navigate('/announcements')}
                  aria-label={isAr ? 'عرض كل الإعلانات' : 'View all announcements'}
                  className="text-xs text-indigo-600 cursor-pointer hover:underline">{t('all')}</button>
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
