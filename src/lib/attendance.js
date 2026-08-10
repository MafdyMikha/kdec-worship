export function dateKeyInTimezone(date = new Date(), timezone = 'Africa/Cairo') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function attendanceOccurrenceDate(session, timezone = 'Africa/Cairo', now = new Date()) {
  if (!session?.repeatable) {
    return session?.service?.date || session?.service_date || dateKeyInTimezone(session?.created_at ? new Date(session.created_at) : now, timezone)
  }

  const localDate = dateKeyInTimezone(now, timezone)
  if (session.repeatFreq === 'monthly' || session.repeat_freq === 'monthly') return `${localDate.slice(0, 8)}01`
  if (session.repeatFreq === 'weekly' || session.repeat_freq === 'weekly') {
    const date = new Date(`${localDate}T12:00:00Z`)
    const daysSinceMonday = (date.getUTCDay() + 6) % 7
    date.setUTCDate(date.getUTCDate() - daysSinceMonday)
    return date.toISOString().slice(0, 10)
  }
  return localDate
}
