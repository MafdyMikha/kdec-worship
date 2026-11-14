import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { cairoToday, calendarEntries, entryOnDay, eventStage } from './planningCalendar.js'

const cairoClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function buildDashboardSchedule(services, userId, now = new Date(), { timezone = 'Africa/Cairo', slots = [] } = {}) {
  const today = cairoToday(now)
  const clock = cairoClock.format(now)
  const organizationToday = timezone === 'Africa/Cairo' ? today : new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const scheduledAssignmentIds = new Set(slots.filter(slot => slot.personId === userId).map(slot => slot.serviceId))
  const published = services.filter(event =>
    !event.archivedAt && eventStage(event) === 'published' && event.status !== 'completed',
  )
  const assignment = event => event.team.find(member => member.personId === userId)
  const personal = event => {
    const member = assignment(event)
    return !event.declinedPersonIds?.includes(userId)
      && (member ? member.status !== 'declined' : event.participantIds?.includes(userId))
  }
  const upcoming = calendarEntries(published, today, '9999-12-31', { cancelled: false })
    .filter(event => (event.endDate || event.date) > today
      || (event.endTime || event.time || '23:59').slice(0, 5) >= clock)
  const nextPersonal = upcoming.find(personal)
  // Quarterly slots use Cairo's date. Direct assignments use the organization's date.
  const pending = upcoming.filter(event => !event.isRehearsal && event.status === 'scheduled'
    && event.date >= (scheduledAssignmentIds.has(event.id) ? today : organizationToday)
    && assignment(event)?.status === 'pending')
  const weekStart = startOfWeek(parseISO(today), { weekStartsOn: 0 })
  const weekEnd = format(addDays(weekStart, 7), 'yyyy-MM-dd')
  const week = calendarEntries(services.filter(event => eventStage(event) === 'published'), format(weekStart, 'yyyy-MM-dd'), weekEnd, { cancelled: false })
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = format(addDays(weekStart, offset), 'yyyy-MM-dd')
    return { date, events: week.filter(event => entryOnDay(event, date)) }
  })
  return { today, upcoming, nextPersonal, next: nextPersonal || upcoming[0], pending, days, assignment, personal }
}


export function resolveDashboardEvent(visibleDays, selectedDay, selectedEventId, upcomingEvent) {
  const selectedEvent = visibleDays.flatMap(day => day.events).find(event => event.calendarId === selectedEventId)
    || (selectedDay ? visibleDays[0]?.events[0] : null)
    || null
  return { selectedEvent, next: selectedEvent || (selectedDay ? null : upcomingEvent) }
}
