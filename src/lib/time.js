// One ordered model for rendering and updating the 12-hour controls, including RTL.
export const TIME_FIELDS = Object.freeze([
  Object.freeze({ key:'hour', options:Object.freeze(Array.from({ length:12 }, (_, i) => String(i + 1))) }),
  Object.freeze({ key:'minute', options:Object.freeze(Array.from({ length:60 }, (_, i) => String(i).padStart(2, '0'))) }),
  Object.freeze({ key:'period', options:Object.freeze(['AM', 'PM']) }),
])

export function timeParts(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value || '')
  if (!match || +match[1] > 23 || +match[2] > 59) return null
  return { hour: String(+match[1] % 12 || 12), minute: match[2], period: +match[1] >= 12 ? 'PM' : 'AM' }
}

export function time24(hour, minute, period) {
  if (!TIME_FIELDS[0].options.includes(String(hour)) ||
      !TIME_FIELDS[1].options.includes(String(minute)) ||
      !TIME_FIELDS[2].options.includes(period)) return ''
  return `${String((+hour % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${minute}`
}

export function updateTimePart(value, field, next) {
  if (!TIME_FIELDS.find(item => item.key === field)?.options.includes(next)) return value || ''
  const parts = { hour:'12', minute:'00', period:'AM', ...timeParts(value), [field]:next }
  return time24(parts.hour, parts.minute, parts.period)
}

export function formatClock(value, isAr = false) {
  const parts = timeParts(value)
  if (parts && isAr) {
    const [hours, minutes] = time24(parts.hour, parts.minute, parts.period).split(':').map(Number)
    return new Intl.DateTimeFormat('ar-EG', {
      hour:'numeric', minute:'2-digit', hour12:true, timeZone:'UTC',
    }).format(new Date(Date.UTC(2020, 0, 1, hours, minutes)))
  }
  return parts ? `${parts.hour}:${parts.minute} ${parts.period}` : (value || '—')
}
