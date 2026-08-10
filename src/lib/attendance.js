export function dateKeyInTimezone(date = new Date(), timezone = 'Africa/Cairo') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function localDateTimeParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone,
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return {
    date:`${values.year}-${values.month}-${values.day}`,
    minutes:(Number(values.hour) * 60) + Number(values.minute),
  }
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return (hours * 60) + minutes
}

function dateOrdinal(value) {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

export function addMinutesToTime(value, amount) {
  const minutes = timeToMinutes(value)
  if (minutes === null) return ''
  const wrapped = ((minutes + amount) % 1440 + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

export function attendanceOccurrenceDate(session, timezone = 'Africa/Cairo', now = new Date()) {
  if (!session?.repeatable) {
    return session?.sessionDate || session?.session_date || session?.service?.date || session?.service_date || dateKeyInTimezone(session?.created_at ? new Date(session.created_at) : now, timezone)
  }

  return dateKeyInTimezone(now, timezone)
}

export function attendanceTiming(record, session, timezone = 'Africa/Cairo', lateMinutes = 0) {
  const occurrenceDate = record?.occurrence_date || attendanceOccurrenceDate(session, timezone)
  const occurrenceOrdinal = dateOrdinal(occurrenceDate)
  const startMinutes = timeToMinutes(session?.sessionTime || session?.session_time)
  const endMinutes = timeToMinutes(session?.endTime || session?.end_time)

  let arrival = null
  if (record?.check_in_at && occurrenceOrdinal !== null && startMinutes !== null) {
    const localCheckIn = localDateTimeParts(new Date(record.check_in_at), timezone)
    const checkInOrdinal = dateOrdinal(localCheckIn.date)
    const checkInValue = ((checkInOrdinal - occurrenceOrdinal) * 1440) + localCheckIn.minutes
    if (checkInValue < startMinutes) arrival = 'early'
    else if (checkInValue <= startMinutes + Math.max(0, Number(lateMinutes) || 0)) arrival = 'on_time'
    else arrival = 'late'
  }

  let departure = null
  if (record?.check_out_at && occurrenceOrdinal !== null && startMinutes !== null && endMinutes !== null) {
    const localCheckOut = localDateTimeParts(new Date(record.check_out_at), timezone)
    const checkOutOrdinal = dateOrdinal(localCheckOut.date)
    const checkOutValue = ((checkOutOrdinal - occurrenceOrdinal) * 1440) + localCheckOut.minutes
    const scheduledEnd = endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes
    departure = checkOutValue < scheduledEnd ? 'early' : 'normal'
  }

  return { arrival, departure }
}
