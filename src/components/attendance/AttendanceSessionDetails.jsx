import { Calendar, Clock, Link2, Users } from 'lucide-react'
import { attendanceTiming } from '../../lib/attendance.js'
import { formatAttendanceTime, formatAttendanceTimestamp } from '../../lib/attendanceReport.js'
import { Avatar, Badge } from '../ui'

const timingLabel = (value, isAr) => ({
  early:isAr ? 'مبكر' : 'Early', on_time:isAr ? 'في الموعد' : 'On time',
  late:isAr ? 'متأخر' : 'Late', normal:isAr ? 'خروج طبيعي' : 'Normal checkout',
}[value] || '—')
const timingColor = value => ({ early:'blue', on_time:'green', late:'red', normal:'green' }[value] || 'slate')

export default function AttendanceSessionDetails({ session, records = [], people = [], timezone = 'Africa/Cairo', lateMinutes = 0, isAr = false }) {
  if (!session) return null
  const date = session.sessionDate || session.session_date || session.service?.date || '—'
  const start = session.sessionTime || session.session_time
  const end = session.endTime || session.end_time

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3"><Calendar size={18} className="text-indigo-500"/><div><div className="text-xs text-slate-400">{isAr?'التاريخ':'Date'}</div><div className="text-sm font-semibold text-slate-700">{date}</div></div></div>
        <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3"><Clock size={18} className="text-indigo-500"/><div><div className="text-xs text-slate-400">{isAr?'الوقت':'Time'}</div><div className="text-sm font-semibold text-slate-700">{formatAttendanceTime(start, isAr)} – {formatAttendanceTime(end, isAr)}</div></div></div>
        <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3"><Users size={18} className="text-indigo-500"/><div><div className="text-xs text-slate-400">{isAr?'الحضور':'Attendance'}</div><div className="text-sm font-semibold text-slate-700">{records.filter(record => record.check_in_at).length}{session.max_attendees ? ` / ${session.max_attendees}` : ''}</div></div></div>
        <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3"><Link2 size={18} className="text-indigo-500"/><div className="min-w-0"><div className="text-xs text-slate-400">{isAr?'الخدمة المرتبطة':'Linked service'}</div><div className="text-sm font-semibold text-slate-700 truncate" dir="auto">{session.service?.title || (isAr?'لا توجد خدمة مرتبطة':'Not linked')}</div></div></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge color={session.active ? 'green' : 'slate'}>{session.active ? (isAr?'نشطة':'Active') : (isAr?'مغلقة':'Closed')}</Badge>
        <Badge color="indigo">{session.label || (isAr?'حضور':'Attendance')}</Badge>
        {session.repeatable && <Badge color="purple">{isAr?'جلسة متكررة':'Repeatable session'}</Badge>}
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 mb-3">{isAr?'سجل حضور الفعالية':'Event attendance'}</h3>
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{isAr?'لا يوجد حضور لهذه الفعالية بعد':'No attendance has been recorded for this event yet'}</div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-start">{isAr?'العضو':'Member'}</th><th className="p-3 text-start">{isAr?'التاريخ':'Date'}</th><th className="p-3 text-start">{isAr?'الدخول':'Check in'}</th><th className="p-3 text-start">{isAr?'الوصول':'Arrival'}</th><th className="p-3 text-start">{isAr?'الخروج':'Check out'}</th><th className="p-3 text-start">{isAr?'المغادرة':'Departure'}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {records.map(record => {
                  const person = people.find(item => String(item.id) === String(record.person_id))
                  const timing = attendanceTiming(record, session, timezone, lateMinutes)
                  return <tr key={record.id} className="hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-2"><Avatar name={person?.name || '?'} size="xs"/><span className="font-medium text-slate-700" dir="auto">{person?.name || (isAr?'عضو غير معروف':'Unknown member')}</span></div></td><td className="p-3 text-slate-500">{record.occurrence_date || date}</td><td className="p-3 text-slate-500">{formatAttendanceTimestamp(record.check_in_at, timezone, isAr)}</td><td className="p-3">{timing.arrival ? <Badge color={timingColor(timing.arrival)} size="xs">{timingLabel(timing.arrival, isAr)}</Badge> : '—'}</td><td className="p-3 text-slate-500">{formatAttendanceTimestamp(record.check_out_at, timezone, isAr)}</td><td className="p-3">{timing.departure ? <Badge color={timingColor(timing.departure)} size="xs">{timingLabel(timing.departure, isAr)}</Badge> : '—'}</td></tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
