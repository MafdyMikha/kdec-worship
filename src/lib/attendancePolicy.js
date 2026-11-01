import { dateKeyInTimezone, zonedDateTimeToUtc } from './attendance.js'

export const CAIRO = 'Africa/Cairo'
export function validTolerance(value) {
  return (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647
}
export function effectiveTolerance(options = {}, defaults = {}) {
  const mode = options.lateToleranceMode ?? options.late_tolerance_mode ?? 'inherit'
  if (mode === 'none') return 0
  if (mode === 'custom') return Number(options.lateToleranceMinutes ?? options.late_tolerance_minutes ?? 0)
  if (defaults.lateToleranceMode || defaults.late_tolerance_mode) return effectiveTolerance(defaults)
  return defaults.attendanceLateEnabled === false ? 0 : Number(defaults.attendanceLateMinutes ?? 0)
}
export function sessionTolerance(session = {}, defaults = {}) {
  return session.effective_late_minutes ?? session.effectiveLateMinutes ?? effectiveTolerance(session, defaults)
}
export function attendanceSchedule(session, occurrenceDate) {
  const date = occurrenceDate || session.session_date || session.sessionDate
  const start = session.session_time || session.sessionTime
  const end = session.end_time || session.endTime
  const sourceDate = session.session_date || session.sessionDate
  const sourceEnd = session.session_end_date || session.sessionEndDate
  let days = sourceEnd ? Math.round((Date.parse(sourceEnd) - Date.parse(sourceDate)) / 86400000) : end <= start ? 1 : 0
  days = Math.max(0, days)
  const endDate = new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10)
  return { start: zonedDateTimeToUtc(date, start, CAIRO), end: zonedDateTimeToUtc(endDate, end, CAIRO) }
}
export function attendanceSnapshot(record, session, defaults = {}) {
  const date = record.occurrence_date || session.session_date || session.sessionDate
  const schedule = attendanceSchedule(session, date)
  const tolerance = sessionTolerance(session, defaults)
  const at = new Date(record.check_in_at)
  const delta = (at - schedule.start) / 60000
  const arrival = delta < 0 ? 'early' : delta > tolerance ? 'late' : 'on_time'
  return { ...record, scheduled_start_at:schedule.start?.toISOString(), scheduled_end_at:schedule.end?.toISOString(),
    tolerance_minutes:tolerance, arrival_status:arrival, late_by_minutes:arrival === 'late' ? Math.ceil(delta) : 0,
    status:arrival === 'late' ? 'late' : 'present' }
}
export function validOccurrence(session, day) {
  const start = session.session_date || session.sessionDate
  if (!day || !start || day < start) return false
  if (!session.repeatable) return day === start
  const gap = Math.round((Date.parse(day) - Date.parse(start)) / 86400000)
  const freq = session.repeat_freq || session.repeatFreq
  if (freq === 'daily') return true
  if (freq === 'weekly') return gap % 7 === 0
  const monthEnd = new Date(Date.UTC(+day.slice(0,4), +day.slice(5,7), 0)).getUTCDate()
  return freq === 'monthly' && +day.slice(8) === Math.min(+start.slice(8), monthEnd)
}
export function nextAttendanceOccurrence(session, now = new Date()) {
  if (!session.repeatable) return session.session_date || session.sessionDate
  const today = dateKeyInTimezone(now, CAIRO)
  let day = [today, session.session_date || session.sessionDate].sort().at(-1)
  for (let i = 0; i < 32; i++) {
    if (validOccurrence(session, day)) return day
    day = new Date(Date.parse(day) + 86400000).toISOString().slice(0,10)
  }
  return today
}
export function attendanceCodeError(session, code, day, now = new Date()) {
  if (!session || !code || code.revoked) return 'This attendance code has been revoked or is invalid.'
  if (!session.active) return 'This attendance session is closed.'
  if (!validOccurrence(session, day)) return 'This code is not valid for this occurrence.'
  const schedule = attendanceSchedule(session, day)
  const opens = zonedDateTimeToUtc(day, '00:00', CAIRO)
  const expiry = Math.min(new Date(session.expires_at).getTime(), schedule.end?.getTime() + 6 * 3600000)
  if (now < opens || now.getTime() >= expiry) return 'This attendance code is not active yet or has expired.'
  return ''
}
export function attendanceError(message, isAr) {
  if (!isAr) return message
  const translations = {
    'This attendance code has been revoked or is invalid.':'رمز الحضور ملغى أو غير صالح.',
    'This attendance session is closed.':'جلسة الحضور مغلقة.',
    'This code is not valid for this occurrence.':'الرمز غير صالح لهذا الموعد.',
    'This attendance code is not active yet or has expired.':'رمز الحضور لم يبدأ بعد أو انتهت صلاحيته.',
    'Publish and enable attendance for this event first.':'انشر الفعالية وفعّل الحضور أولًا.',
    'Enter a non-negative whole number of minutes.':'أدخل عدد دقائق صحيحًا لا يقل عن صفر.',
  }
  return translations[message] || message
}
