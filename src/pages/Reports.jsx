import { useState } from 'react'
import { BarChart3, Music2, Users, Calendar, TrendingUp, Award, ChevronRight } from 'lucide-react'
import { useStore, roleLabel } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Badge, Avatar, StatCard, Tabs } from '../components/ui'
import { format, subMonths, parseISO } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'

function Bar({ value, max, color = 'bg-indigo-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width:`${pct}%` }}/>
      </div>
      <span className="text-xs text-slate-500 w-6 text-right">{value}</span>
    </div>
  )
}

const RCOLS = ['bg-indigo-500','bg-violet-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-cyan-400','bg-pink-400']

export default function Reports() {
  const { isAr, t, lang } = useLang()
  const { services, songs, people } = useStore()
  const [tab, setTab] = useState('overview')

  // ── Computed stats ────────────────────────────────────────
  const activePeople = people.filter(p => p.status === 'active')
  const topSongs     = songs.filter(s => s.usageCount > 0).sort((a,b) => (b.usageCount||0) - (a.usageCount||0)).slice(0, 8)
  const maxUsage     = topSongs[0]?.usageCount || 1
  const totalAsgn    = services.flatMap(s => s.team).length
  const confirmed    = services.flatMap(s => s.team).filter(t => t.status === 'confirmed').length
  const declined     = services.flatMap(s => s.team).filter(t => t.status === 'declined').length
  const pending      = services.flatMap(s => s.team).filter(t => t.status === 'pending').length
  const confRate     = totalAsgn > 0 ? Math.round((confirmed / totalAsgn) * 100) : 0
  const subRate      = totalAsgn > 0 ? Math.round((declined  / totalAsgn) * 100) : 0

  const roleCounts = {}
  people.forEach(p => (p.roles?.length ? p.roles : [p.role]).filter(Boolean).forEach(role => {
    roleCounts[role] = (roleCounts[role]||0) + 1
  }))
  const roles   = Object.entries(roleCounts).sort((a,b) => b[1] - a[1]).slice(0, 8)
  const maxRole = roles[0]?.[1] || 1

  const personCount = {}
  services.forEach(s => s.team.forEach(tm => { personCount[tm.personId] = (personCount[tm.personId]||0) + 1 }))
  const topPeople = Object.entries(personCount).sort((a,b) => b[1] - a[1]).slice(0, 6)
    .map(([id, count]) => ({ person: people.find(p => p.id === id), count })).filter(x => x.person)

  // Monthly bar chart
  const monthMap = {}
  for (let i = 5; i >= 0; i--) {
    const m   = subMonths(new Date(), i)
    const key = format(m, isAr ? 'MMM' : 'MMM', { locale: isAr ? arLocale : undefined })
    monthMap[key] = services.filter(s => format(parseISO(s.date),'MMM yyyy') === format(m,'MMM yyyy')).length
  }
  const maxMonth = Math.max(...Object.values(monthMap), 1)

  const enSongs   = songs.filter(s => s.language === 'en').length
  const arSongs   = songs.filter(s => s.language === 'ar').length
  const bothSongs = songs.filter(s => s.language === 'both').length

  const servicesWithPractice  = services.filter(s => s.practice?.enabled)
  const practiceAtt           = servicesWithPractice.flatMap(s => s.practice?.attendance || [])
  const practiceAttending     = practiceAtt.filter(a => a.status === 'attending').length
  const practiceRate          = practiceAtt.length > 0 ? Math.round((practiceAttending / practiceAtt.length) * 100) : 0

  const svcCountPerPerson = people.map(p => ({
    person: p,
    count:     services.filter(s => s.team.find(tm => tm.personId === p.id)).length,
    confirmed: services.filter(s => s.team.find(tm => tm.personId === p.id && tm.status === 'confirmed')).length,
  })).filter(x => x.count > 0).sort((a,b) => b.count - a.count)

  const TABS = [
    { label: t('overview'),       value: 'overview'  },
    { label: t('songsLabel'),     value: 'songs'     },
    { label: t('team'),           value: 'team'      },
    { label: t('servicesLabel'),  value: 'services'  },
  ]

  return (
    <div className="max-w-6xl space-y-6 animate-fade-in">
      <Tabs tabs={TABS} active={tab} onChange={setTab}/>

      {/* ── Overview ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t('servicesLabel')}  value={services.length}     icon={<Calendar size={20}/>}   color="blue"/>
            <StatCard label={t('activeMembers')}   value={activePeople.length} icon={<Users size={20}/>}      color="indigo"/>
            <StatCard label={t('songLibrary')}     value={songs.length}        icon={<Music2 size={20}/>}     color="purple"/>
            <StatCard label={t('confirmRate')}     value={`${confRate}%`}      icon={<TrendingUp size={20}/>} color="green"/>
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('practiceRate'),     value: `${practiceRate}%`, color: 'text-emerald-600' },
              { label: t('practiceStats'),    value: servicesWithPractice.length, color: 'text-violet-600' },
              { label: t('pendingResponses'), value: pending,             color: 'text-amber-600'   },
              { label: t('declineRate'),      value: `${subRate}%`,       color: 'text-red-500'     },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <div className={`text-2xl font-display font-bold ${color}`}>{value}</div>
                <div className="text-xs text-slate-500 mt-1">{label}</div>
              </Card>
            ))}
          </div>

          {/* Monthly bar chart */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600"><BarChart3 size={15}/></div>
              <h3 className="font-display font-semibold text-slate-800">
                {t('servicesPerMonth')} — {isAr ? 'آخر 6 أشهر' : 'Last 6 months'}
              </h3>
            </div>
            <div className="flex items-end gap-2 h-36">
              {Object.entries(monthMap).map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-slate-600">{count}</span>
                  <div className="w-full bg-slate-100 rounded-t-lg relative" style={{ height:'100px' }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t-lg transition-all duration-700"
                      style={{ height:`${maxMonth > 0 ? Math.round((count/maxMonth)*100) : 0}px` }}/>
                  </div>
                  <span className="text-xs text-slate-400">{month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Song language breakdown */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-3">{t('songLibrary')}</h3>
            <div className="flex items-center gap-6">
              <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-indigo-500 h-full" style={{ width:`${songs.length > 0 ? (enSongs/songs.length)*100 : 0}%` }}/>
                <div className="bg-amber-400 h-full" style={{ width:`${songs.length > 0 ? (arSongs/songs.length)*100 : 0}%` }}/>
                {bothSongs > 0 && <div className="bg-violet-400 h-full" style={{ width:`${songs.length > 0 ? (bothSongs/songs.length)*100 : 0}%` }}/>}
              </div>
              <div className="flex gap-4 text-sm flex-shrink-0">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-500"/>{t('english')} ({enSongs})</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"/>{t('arabic')} ({arSongs})</span>
                {bothSongs > 0 && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-violet-400"/>{t('both')} ({bothSongs})</span>}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Songs ────────────────────────────────────────── */}
      {tab === 'songs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><Music2 size={15}/></div>
              <h3 className="font-display font-semibold text-slate-800">{t('mostUsedSongs')}</h3>
            </div>
            {topSongs.length === 0
              ? <p className="text-slate-400 text-sm">{isAr ? 'لا توجد بيانات استخدام بعد' : 'No usage data yet'}</p>
              : topSongs.map((song, i) => (
                <div key={song.id} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4">{i+1}.</span>
                      {/* Song title always in Arabic (primary language) */}
                      <span className="text-sm font-medium text-slate-700 truncate max-w-44" dir="rtl">{song.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge color="slate" size="xs">{song.key}</Badge>
                      <span className="text-xs text-slate-400">{song.usageCount}×</span>
                    </div>
                  </div>
                  <Bar value={song.usageCount} max={maxUsage} color={i===0?'bg-indigo-500':i<3?'bg-indigo-400':'bg-indigo-300'}/>
                </div>
              ))
            }
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4">{isAr ? 'الترانيم حسب اللغة' : 'Songs by Language'}</h3>
            <div className="space-y-4">
              {[
                [t('english'), enSongs,   'bg-indigo-500'],
                [t('arabic'),  arSongs,   'bg-amber-400' ],
                [t('both'),    bothSongs, 'bg-violet-400'],
              ].map(([label, count, color]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{label}</span>
                    <span className="text-slate-500">{count} {isAr ? 'ترنيمة' : 'songs'}</span>
                  </div>
                  <Bar value={count} max={songs.length || 1} color={color}/>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">{isAr ? 'آخر الإضافات' : 'Recently Added'}</h4>
              {songs.slice(-4).reverse().map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5">
                  {/* Song title always Arabic */}
                  <span className="text-sm text-slate-700" dir="rtl">{s.title}</span>
                  <Badge color="slate" size="xs">{s.key}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Team ─────────────────────────────────────────── */}
      {tab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600"><Users size={15}/></div>
              <h3 className="font-display font-semibold text-slate-800">{t('teamByRole')}</h3>
            </div>
            {roles.length === 0
              ? <p className="text-slate-400 text-sm">{isAr ? 'لا يوجد أعضاء بعد' : 'No members yet'}</p>
              : roles.map(([role, count], i) => (
                <div key={role} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{role}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <Bar value={count} max={maxRole} color={RCOLS[i % RCOLS.length]}/>
                </div>
              ))
            }
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><Award size={15}/></div>
              <h3 className="font-display font-semibold text-slate-800">{t('mostActive')}</h3>
            </div>
            {topPeople.length === 0
              ? <p className="text-slate-400 text-sm">{isAr ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
              : topPeople.map(({ person, count }, i) => (
                <div key={person.id} className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <Avatar name={person.name} size="sm"/>
                    {i === 0 && <span className="absolute -top-1 -right-1 text-xs">🏆</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Name always Latin */}
                    <div className="text-sm font-medium text-slate-700 truncate" dir="ltr">{person.name}</div>
                    <div className="text-xs text-slate-400">{roleLabel(person)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-indigo-600">{count}</div>
                    <div className="text-xs text-slate-400">{isAr ? 'خدمة' : 'services'}</div>
                  </div>
                </div>
              ))
            }
          </Card>

          {/* All members service record */}
          <Card className="p-5 lg:col-span-2">
            <h3 className="font-display font-semibold text-slate-800 mb-4">{t('serviceHistory')}</h3>
            <div className="space-y-2">
              {svcCountPerPerson.map(({ person, count, confirmed: conf }) => {
                const rate = count > 0 ? Math.round((conf / count) * 100) : 0
                return (
                  <div key={person.id} className="flex items-center gap-3">
                    <Avatar name={person.name} size="sm"/>
                    <div className="w-36 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate" dir="ltr">{person.name}</div>
                      <div className="text-xs text-slate-400">{roleLabel(person)}</div>
                    </div>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${rate>=80?'bg-emerald-500':rate>=50?'bg-amber-400':'bg-red-400'}`} style={{ width:`${rate}%` }}/>
                    </div>
                    <span className="text-xs text-slate-500 w-24 text-right">
                      {conf}/{count} {isAr ? 'مؤكدة' : 'confirmed'}
                    </span>
                    <span className={`text-xs font-bold w-8 text-right ${rate>=80?'text-emerald-600':rate>=50?'text-amber-500':'text-red-500'}`}>{rate}%</span>
                  </div>
                )
              })}
              {svcCountPerPerson.length === 0 && (
                <p className="text-slate-400 text-sm">{isAr ? 'لا توجد بيانات تكليف بعد' : 'No assignment data yet'}</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Services ─────────────────────────────────────── */}
      {tab === 'services' && (
        <div className="space-y-5">
          {/* Big numbers */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: isAr?'إجمالي الخدمات':'Total Services',   value: services.length,                                    color:'text-indigo-600' },
              { label: t('completed'),                             value: services.filter(s=>s.status==='completed').length,  color:'text-emerald-600'},
              { label: t('upcoming'),                             value: services.filter(s=>s.status==='scheduled').length,  color:'text-blue-600'   },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <div className={`text-3xl font-display font-bold ${color}`}>{value}</div>
                <div className="text-sm text-slate-500 mt-1">{label}</div>
              </Card>
            ))}
          </div>

          {/* By type */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4">{t('servicesByType')}</h3>
            {Object.entries(
              services.reduce((acc, s) => { acc[s.type] = (acc[s.type]||0) + 1; return acc }, {})
            ).sort((a,b) => b[1]-a[1]).map(([type, count], i) => (
              <div key={type} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">{type}</span>
                  <span className="text-slate-400">{count}</span>
                </div>
                <Bar value={count} max={services.length || 1} color={RCOLS[i % RCOLS.length]}/>
              </div>
            ))}
            {services.length === 0 && <p className="text-slate-400 text-sm">{isAr?'لا توجد خدمات بعد':'No services yet'}</p>}
          </Card>

          {/* Practice stats */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4">{t('practiceStats')}</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: isAr?'خدمات بها بروفة':'Services with practice', value: servicesWithPractice.length, bg:'bg-emerald-50', color:'text-emerald-600' },
                { label: isAr?'حضور البروفة':'Practice attendees',         value: practiceAttending,            bg:'bg-indigo-50',  color:'text-indigo-600'  },
                { label: isAr?'نسبة الحضور':'Attendance rate',             value: `${practiceRate}%`,            bg:'bg-violet-50',  color:'text-violet-600'  },
              ].map(({ label, value, bg, color }) => (
                <div key={label} className={`${bg} rounded-xl p-3`}>
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Setlist stats */}
          <Card className="p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-3">{t('setlistStats')}</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: t('avgSongs'),    value: services.length > 0 ? Math.round(services.reduce((s,svc) => s+(svc.setlist?.length||0),0)/services.length) : 0 },
                { label: t('totalSlots'),  value: services.reduce((s,svc) => s+(svc.setlist?.length||0), 0) },
                { label: t('avgTeamSize'), value: services.length > 0 ? Math.round(services.reduce((s,svc) => s+(svc.team?.length||0),0)/services.length) : 0 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-2xl font-bold text-slate-700">{value}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
