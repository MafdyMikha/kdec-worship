import { attendanceTiming } from './attendance.js'
import { downloadExcelWorkbook } from './excelExport.js'

const sessionName = session => session?.name || session?.service?.title || session?.label || 'Attendance session'
const sessionDate = (record, session) => record?.occurrence_date || session?.sessionDate || session?.session_date || session?.service?.date || ''

export function formatAttendanceTime(value, isAr = false) {
  if (!value) return '—'
  const [hours, minutes] = String(value).split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return '—'
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
    hour:'numeric', minute:'2-digit', hour12:true, timeZone:'UTC',
  }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)))
}

export function formatAttendanceTimestamp(value, timezone = 'Africa/Cairo', isAr = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', {
    timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'numeric', minute:'2-digit', hour12:true,
  }).format(date)
}

export function buildAttendanceReport({ sessions = [], recordsBySession = {}, people = [], timezone = 'Africa/Cairo', lateMinutes = 0 }) {
  const sessionMap = new Map(sessions.map(session => [String(session.id), session]))
  const peopleMap = new Map(people.map(person => [String(person.id), person]))
  const rows = Object.entries(recordsBySession).flatMap(([sessionId, records]) => (records || []).map(record => {
    const session = sessionMap.get(String(sessionId)) || sessions.find(item => String(item.id) === String(record.session_id))
    const person = peopleMap.get(String(record.person_id))
    const timing = attendanceTiming(record, session, timezone, lateMinutes)
    return {
      id:record.id,
      sessionId:record.session_id || sessionId,
      session,
      sessionName:sessionName(session),
      sessionType:session?.label || '',
      date:sessionDate(record, session),
      startTime:session?.sessionTime || session?.session_time || '',
      endTime:session?.endTime || session?.end_time || '',
      person,
      personId:record.person_id,
      personName:person?.name || 'Unknown member',
      role:person?.role || person?.roles?.join(', ') || '',
      checkInAt:record.check_in_at,
      checkOutAt:record.check_out_at,
      status:record.status || '',
      arrival:timing.arrival,
      departure:timing.departure,
    }
  })).sort((a, b) => `${b.date}|${b.checkInAt || ''}`.localeCompare(`${a.date}|${a.checkInAt || ''}`))

  const summaries = people.map(person => {
    const personRows = rows.filter(row => String(row.personId) === String(person.id))
    return {
      person,
      records:personRows.length,
      early:personRows.filter(row => row.arrival === 'early').length,
      onTime:personRows.filter(row => row.arrival === 'on_time').length,
      late:personRows.filter(row => row.arrival === 'late').length,
      earlyCheckout:personRows.filter(row => row.departure === 'early').length,
      normalCheckout:personRows.filter(row => row.departure === 'normal').length,
    }
  }).filter(summary => summary.records > 0).sort((a, b) => b.records - a.records || (a.person.name || '').localeCompare(b.person.name || ''))

  return { rows, summaries }
}

const timingText = (value, isAr) => ({
  early:isAr ? 'مبكر' : 'Early',
  on_time:isAr ? 'في الموعد' : 'On time',
  late:isAr ? 'متأخر' : 'Late',
  normal:isAr ? 'طبيعي' : 'Normal',
}[value] || '')

export function downloadAttendanceReport(report, { isAr = false, timezone = 'Africa/Cairo', filename = 'kdec-attendance-report' } = {}) {
  const recordColumns = isAr
    ? ['الجلسة / الفعالية','النوع','التاريخ','البداية','النهاية','العضو','الدور','الدخول','حالة الوصول','الخروج','حالة المغادرة','الحالة']
    : ['Session / Event','Type','Date','Start','End','Member','Role','Check in','Arrival','Check out','Departure','Status']
  const summaryColumns = isAr
    ? ['العضو','إجمالي الحضور','مبكر','في الموعد','متأخر','خروج مبكر','خروج طبيعي']
    : ['Member','Total attendance','Early','On time','Late','Early checkout','Normal checkout']

  downloadExcelWorkbook(filename, [
    {
      name:isAr ? 'سجل الحضور' : 'Attendance Records',
      columns:recordColumns,
      rows:report.rows.map(row => [
        row.sessionName, row.sessionType, row.date,
        formatAttendanceTime(row.startTime, isAr), formatAttendanceTime(row.endTime, isAr),
        row.personName, row.role, formatAttendanceTimestamp(row.checkInAt, timezone, isAr),
        timingText(row.arrival, isAr), formatAttendanceTimestamp(row.checkOutAt, timezone, isAr),
        timingText(row.departure, isAr), row.status,
      ]),
    },
    {
      name:isAr ? 'ملخص الأعضاء' : 'Member Summary',
      columns:summaryColumns,
      rows:report.summaries.map(summary => [
        summary.person.name, summary.records, summary.early, summary.onTime, summary.late,
        summary.earlyCheckout, summary.normalCheckout,
      ]),
    },
  ])
}
