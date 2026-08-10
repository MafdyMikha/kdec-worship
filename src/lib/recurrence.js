import { addMonths, addWeeks, format, parseISO } from 'date-fns'

export function generateOccurrences(base, recurrence) {
  if (!recurrence?.enabled) return []
  const { frequency, count, endDate } = recurrence
  const startIndex = Math.max(0, Number(recurrence.startIndex) || 0)
  const start = parseISO(base.date)
  const maxCount = Number.isFinite(count) ? Math.max(0, count) : 12
  const until = endDate ? parseISO(endDate) : null
  const results = []

  for (let i = startIndex + 1; i <= startIndex + maxCount; i++) {
    const cursor = frequency === 'monthly'
      ? addMonths(start, i)
      : addWeeks(start, (frequency === 'biweekly' ? 2 : 1) * i)
    if (until && cursor > until) break
    results.push({
      title:base.title, date:format(cursor,'yyyy-MM-dd'), time:base.time,
      type:base.type, status:'scheduled', notes:base.notes || '',
      recurrence_group_id:base.recurrence_group_id || base.id,
      recurrenceGroupId:base.recurrence_group_id || base.id,
      recurrence_index:i, recurrenceIndex:i,
    })
  }
  return results
}
