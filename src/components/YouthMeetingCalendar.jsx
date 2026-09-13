import { useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { ar } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { hasPermission } from '../lib/permissions.js'
import { Card, Btn } from './ui'

export default function YouthMeetingCalendar() {
  const { services, currentUser, openYouthMeeting } = useStore()
  const { isAr } = useLang()
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locale = isAr ? ar : undefined
  const meetings = new Map(services.filter(service => service.weeklyTemplateKey === 'youth').map(service => [service.date, service]))
  const days = []
  const end = endOfWeek(endOfMonth(month))
  for (let date = startOfWeek(month); date <= end; date = addDays(date, 1)) days.push(date)
  const chosen = meetings.get(selected)
  const canCreate = hasPermission(currentUser, 'services.create')
  const open = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await openYouthMeeting(selected)
      if (result.error) setError(result.error)
      else navigate(`/services/${result.id}`)
    } catch { setError(isAr ? 'تعذر فتح الاجتماع. حاول مرة أخرى.' : 'Could not open the meeting. Please try again.') }
    finally { setBusy(false) }
  }
  return <Card className="p-4 sm:p-6 space-y-5">
    <div>
      <h2 className="text-xl font-semibold">{isAr ? 'اجتماع الشباب' : 'Youth Meeting'}</h2>
      <p className="mt-1 text-sm text-slate-500">{isAr ? 'كل جمعة الساعة ٦ مساءً. اختر التاريخ ثم أضف الفريق والساوند تشيك والبروفة وباقي التفاصيل.' : 'Every Friday at 6:00 PM. Choose a date, then add the team, soundcheck, rehearsal and other details.'}</p>
    </div>
    <div className="flex items-center justify-between gap-2">
      <button type="button" disabled={busy} aria-label={isAr ? 'الشهر السابق' : 'Previous month'} onClick={() => { setMonth(addMonths(month,-1)); setSelected('') }} className="p-3 rounded-lg hover:bg-slate-100"><ChevronLeft size={20} className="rtl:rotate-180"/></button>
      <h3 aria-live="polite" className="font-semibold">{format(month,'MMMM yyyy',{locale})}</h3>
      <button type="button" disabled={busy} aria-label={isAr ? 'الشهر التالي' : 'Next month'} onClick={() => { setMonth(addMonths(month,1)); setSelected('') }} className="p-3 rounded-lg hover:bg-slate-100"><ChevronRight size={20} className="rtl:rotate-180"/></button>
    </div>
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.slice(0,7).map(day => <div key={day.getDay()} className="text-center text-xs text-slate-500 pb-2">{format(day,'EEEEEE',{locale})}</div>)}
      {days.map(day => {
        const key = format(day,'yyyy-MM-dd')
        const meeting = meetings.get(key)
        const enabled = day.getMonth() === month.getMonth() && day.getDay() === 5 && (canCreate || meeting)
        return <button key={key} type="button" disabled={!enabled || busy} aria-pressed={selected === key}
          aria-label={`${format(day,'EEEE d MMMM yyyy',{locale})}${meeting?.status === 'cancelled' ? (isAr ? '، ملغى' : ', cancelled') : ''}`}
          onClick={() => { setSelected(key); setError('') }}
          className={`min-h-12 sm:min-h-16 rounded-xl border text-sm ${selected === key ? 'bg-indigo-600 border-indigo-600 text-white' : enabled ? 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100' : 'border-transparent text-slate-300'}`}>
          <span>{format(day,'d',{locale})}</span>
          {enabled && <span className="block text-[10px] sm:text-xs">{meeting?.status === 'cancelled' ? (isAr ? 'ملغى' : 'Cancelled') : '18:00'}</span>}
        </button>
      })}
    </div>
    {selected && <div className="rounded-xl bg-slate-50 p-4 space-y-3">
      <p className="font-medium"><bdi>{selected}</bdi> · {isAr ? '٦ مساءً' : '6:00 PM'}</p>
      {chosen && <p className="text-sm text-slate-500">{chosen.team.length} {isAr ? 'عضو في الفريق' : 'team members'}{chosen.status === 'cancelled' ? (isAr ? ' · هذا الموعد ملغى' : ' · This occurrence is cancelled') : ''}</p>}
      <Btn onClick={open} disabled={busy}>{busy ? (isAr ? 'جارٍ الفتح...' : 'Opening...') : (isAr ? 'فتح الاجتماع والتفاصيل' : 'Open meeting & details')}</Btn>
    </div>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </Card>
}
