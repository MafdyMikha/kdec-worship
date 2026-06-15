import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock, Music2, Users } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, parseISO, addMonths,
  subMonths, isToday
} from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Badge, Card, Tabs } from '../components/ui'

// Service type → Tailwind colour classes
const TYPE_COLOR = {
  'Sunday Service':           'bg-blue-100   text-blue-700   border-blue-200',
  'Prayer Night':             'bg-violet-100 text-violet-700 border-violet-200',
  'Special Event':            'bg-amber-100  text-amber-700  border-amber-200',
  'Youth Service':            'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Easter':                   'bg-rose-100   text-rose-700   border-rose-200',
  'Christmas':                'bg-red-100    text-red-700    border-red-200',
  'Practice':                 'bg-slate-100  text-slate-600  border-slate-200',
  'خدمة أحد':                 'bg-blue-100   text-blue-700   border-blue-200',
  'ليلة صلاة':                'bg-violet-100 text-violet-700 border-violet-200',
  'فعالية خاصة':              'bg-amber-100  text-amber-700  border-amber-200',
  'خدمة شباب':                'bg-emerald-100 text-emerald-700 border-emerald-200',
  'بروفة':                    'bg-slate-100  text-slate-600  border-slate-200',
}
const DEFAULT_COLOR = 'bg-slate-100 text-slate-600 border-slate-200'

export default function Schedule() {
  const { isAr, t, lang } = useLang()
  const { services, currentUser } = useStore()
  const navigate  = useNavigate()
  const isAdmin   = currentUser?.isAdmin || currentUser?.is_admin
  const [current, setCurrent] = useState(new Date())
  const [view,    setView]    = useState('month')

  const locale     = isAr ? arLocale : undefined
  const monthStart = startOfMonth(current)
  const monthEnd   = endOfMonth(current)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 0 })

  // Build grid days
  const days = []
  let d = calStart
  while (d <= calEnd) { days.push(d); d = addDays(d, 1) }

  // Services in current month (for list view)
  const monthServices = services
    .filter(s => { const sd = parseISO(s.date); return sd >= monthStart && sd <= monthEnd })
    .sort((a, b) => parseISO(a.date) - parseISO(b.date))

  // My services only (for member filter)
  const myIds      = new Set((currentUser ? services.filter(s => s.team.find(tm => tm.personId === currentUser.id)).map(s => s.id) : []))
  const displaySvc = monthServices // admin sees all; future: filter for member view

  // Weekday header labels
  const WEEKDAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const WEEKDAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
  const WEEKDAYS    = isAr ? WEEKDAYS_AR : WEEKDAYS_EN

  // Status labels
  const STATUS_LABEL = {
    scheduled: isAr ? 'مجدولة'  : 'Scheduled',
    completed: isAr ? 'مكتملة'  : 'Completed',
    cancelled: isAr ? 'ملغاة'   : 'Cancelled',
    draft:     isAr ? 'مسودة'   : 'Draft',
  }
  const STATUS_COLOR = { scheduled:'blue', completed:'green', cancelled:'red', draft:'slate' }

  // Month/year header string
  const monthLabel = format(current, isAr ? 'MMMM yyyy' : 'MMMM yyyy', { locale })

  return (
    <div className="max-w-6xl space-y-5 animate-fade-in">

      {/* ── Header row ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors">
            {isAr ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
          </button>
          <h2 className="font-display font-bold text-xl text-slate-800 w-52 text-center">
            {monthLabel}
          </h2>
          <button onClick={() => setCurrent(addMonths(current, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors">
            {isAr ? <ChevronLeft size={18}/> : <ChevronRight size={18}/>}
          </button>
          <button onClick={() => setCurrent(new Date())}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors">
            {isAr ? 'اليوم' : 'Today'}
          </button>
        </div>

        <Tabs
          tabs={[
            { label: isAr ? 'شهري' : 'Month', value: 'month' },
            { label: isAr ? 'قائمة' : 'List',  value: 'list'  },
          ]}
          active={view}
          onChange={setView}
        />
      </div>

      {/* ── Month / Calendar view ───────────────────────── */}
      {view === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const dayServices = services.filter(s => isSameDay(parseISO(s.date), day))
              const inMonth     = isSameMonth(day, current)
              const todayFlag   = isToday(day)
              return (
                <div key={idx}
                  className={`min-h-24 p-2 border-b border-r border-slate-100 last:border-r-0 ${!inMonth ? 'bg-slate-50/60' : ''}`}>
                  {/* Day number */}
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mb-1.5 ${
                    todayFlag   ? 'bg-indigo-600 text-white' :
                    inMonth     ? 'text-slate-700' :
                    'text-slate-300'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  {/* Service chips */}
                  <div className="space-y-0.5">
                    {dayServices.map(svc => (
                      <div key={svc.id}
                        onClick={() => navigate(`/services/${svc.id}`)}
                        className={`text-xs px-1.5 py-0.5 rounded border cursor-pointer truncate font-medium hover:opacity-75 transition-all ${TYPE_COLOR[svc.type] || DEFAULT_COLOR}`}>
                        {svc.time} {svc.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── List view ──────────────────────────────────── */}
      {view === 'list' && (
        <div className="space-y-3">
          {displaySvc.length === 0 ? (
            <Card className="p-10 text-center">
              <Calendar size={32} className="text-slate-200 mx-auto mb-2"/>
              <p className="text-slate-500 text-sm">
                {isAr ? 'لا توجد خدمات هذا الشهر' : 'No services this month'}
              </p>
            </Card>
          ) : displaySvc.map(svc => {
            const isMyService = myIds.has(svc.id)
            const myEntry     = svc.team.find(tm => tm.personId === currentUser?.id)
            const CONF_COLOR  = { confirmed:'green', pending:'yellow', declined:'red' }
            const CONF_LABEL  = { confirmed: isAr?'مؤكد':'Confirmed', pending: isAr?'انتظار':'Pending', declined: isAr?'معتذر':'Declined' }

            return (
              <Card key={svc.id} hover onClick={() => navigate(`/services/${svc.id}`)} className="p-4">
                <div className="flex items-center gap-4">
                  {/* Date block */}
                  <div className="flex-shrink-0 w-16 text-center py-2 bg-slate-50 rounded-xl">
                    <div className="text-xs text-slate-400 font-medium">
                      {format(parseISO(svc.date), isAr ? 'EEE' : 'EEE', { locale })}
                    </div>
                    <div className="text-2xl font-display font-bold text-slate-800">
                      {format(parseISO(svc.date), 'd')}
                    </div>
                    <div className="text-xs text-slate-400">
                      {format(parseISO(svc.date), isAr ? 'MMM' : 'MMM', { locale })}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TYPE_COLOR[svc.type] || DEFAULT_COLOR}`}>
                        {svc.type}
                      </span>
                      <Badge color={STATUS_COLOR[svc.status] || 'slate'} size="xs">
                        {STATUS_LABEL[svc.status] || svc.status}
                      </Badge>
                      {isMyService && myEntry && (
                        <Badge color={CONF_COLOR[myEntry.status] || 'slate'} size="xs">
                          {CONF_LABEL[myEntry.status] || myEntry.status}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-800">{svc.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={11}/>{svc.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Music2 size={11}/>{svc.setlist.length} {isAr ? 'ترنيمة' : 'songs'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={11}/>{svc.team.length} {isAr ? 'عضو' : 'members'}
                      </span>
                      {svc.practice?.enabled && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          🎸 {isAr ? 'بروفة:' : 'Practice:'} {svc.practice.date}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight size={16} className={`text-slate-300 flex-shrink-0 ${isAr ? 'rotate-180' : ''}`}/>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 pt-1">
        {[
          ['Sunday Service',  isAr ? 'خدمة أحد'     : 'Sunday Service'  ],
          ['Prayer Night',    isAr ? 'ليلة صلاة'     : 'Prayer Night'   ],
          ['Special Event',   isAr ? 'فعالية خاصة'   : 'Special Event'  ],
          ['Youth Service',   isAr ? 'خدمة شباب'     : 'Youth Service'  ],
          ['Practice',        isAr ? 'بروفة'          : 'Practice'       ],
        ].map(([typeKey, label]) => (
          <span key={typeKey}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${TYPE_COLOR[typeKey] || DEFAULT_COLOR}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
