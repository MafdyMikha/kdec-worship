export function timeParts(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value || '')
  if (!match || +match[1] > 23 || +match[2] > 59) return null
  return { hour: String(+match[1] % 12 || 12), minute: match[2], period: +match[1] >= 12 ? 'PM' : 'AM' }
}

export function time24(hour, minute, period) {
  return `${String((+hour % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${minute}`
}

export function formatClock(value) {
  const parts = timeParts(value)
  return parts ? `${parts.hour}:${parts.minute} ${parts.period}` : (value || '—')
}
