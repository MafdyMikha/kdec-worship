import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isValid, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'
import { ArrowUpRight, Bell, CalendarDays, Check, ClipboardList, Clock3, ListMusic, RefreshCw, ScanLine, Users } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { buildDashboardSchedule } from '../lib/dashboard.js'
import { eventType, cairoToday } from '../lib/planningCalendar.js'
import { primaryLeader } from '../lib/ministry.js'
import { scheduleLabels } from '../lib/quarterlySchedule.js'
import { hasPermission } from '../lib/permissions.js'
import { formatClock } from '../lib/time.js'
import './dashboard.css'

const detailUrl = event => `/services/${event.parentId || event.id}?view=details`
const setlistUrl = event => `${detailUrl(event)}&tab=setlist`
const scheduleUrl = event => `/schedule?year=${event.date.slice(0, 4)}&quarter=${Math.ceil(Number(event.date.slice(5, 7)) / 3)}&event=${encodeURIComponent(event.parentId || event.id)}`

function Panel({ title, icon, children, className = '' }) {
  return <section className={`dashboard-panel ${className}`}>
    <h2><span className="dashboard-icon">{icon}</span>{title}</h2>
    {children}
  </section>
}

export default function Dashboard({ renderAssignmentActions }) {
  const { services, songs, people, currentUser, announcements, quarterly, worshipRoles, excuseRequests,
    substituteRequests, updateTeamMemberStatus, attendanceSessions, attendanceRecords, loading, dashboardErrors, loadAll } = useStore()
  const { t, isAr } = useLang()
  const [teamView, setTeamView] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [readinessFilter, setReadinessFilter] = useState(null)
  const agendaRef = useRef(null)
  const outgoingAgenda = useRef(null)

  useLayoutEffect(() => {
    const snapshot = outgoingAgenda.current
    if (!snapshot) return
    outgoingAgenda.current = null
    const list = agendaRef.current
    const layer = list.parentElement
    layer.append(snapshot)
    const fadeOut = snapshot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' })
    const fadeIn = list.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
    fadeOut.onfinish = () => snapshot.remove()
    return () => {
      fadeOut.cancel()
      fadeIn.cancel()
      snapshot.remove()
    }
  }, [selectedDay, teamView])

  function changeAgenda(apply) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const snapshot = agendaRef.current.cloneNode(true)
      snapshot.inert = true
      snapshot.setAttribute('aria-hidden', 'true')
      snapshot.classList.add('dashboard-agenda-outgoing')
      outgoingAgenda.current = snapshot
    }
    setSelectedEventId(null)
    setReadinessFilter(null)
    apply()
  }

  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const lang = isAr ? 'ar' : 'en'
  const copy = (en, arabic) => isAr ? arabic : en
  const dateLabel = (date, pattern = 'EEE, d MMM') => format(parseISO(date), pattern, { locale: isAr ? ar : undefined })
  const dateTime = event => <span className="dashboard-meta">{dateLabel(event.date)} <span aria-hidden="true">·</span> <bdi>{formatClock(event.time, isAr)}</bdi></span>
  const schedule = buildDashboardSchedule(services, currentUser.id)
  const { pending, assignment, personal } = schedule
  const canSeeTeam = schedule.upcoming.length > 0 || schedule.days.some(day => day.events.length) || teamView
  const agenda = schedule.days.map(day => ({ ...day, events: day.events.filter(event => teamView || personal(event)) }))
  const selectedDayIndex = agenda.findIndex(day => day.date === selectedDay)
  const visibleDays = agenda.filter(day => (!selectedDay || day.date === selectedDay) && day.events.length)
  const selectedEvent = visibleDays.flatMap(day => day.events).find(event => event.calendarId === selectedEventId)
    || (selectedDay && visibleDays[0]?.events[0]) || null
  const next = selectedEvent || schedule.next
  const nextRole = next && personal(next) ? assignment(next) : null
  const nextSource = services.find(event => event.id === next?.parentId)
  const setlist = [...(nextSource?.setlist || [])].sort((a, b) => a.order - b.order)
  const leaderId = nextSource && primaryLeader(nextSource, worshipRoles)
  const leader = nextSource?.team.find(member => member.personId === leaderId)?.person || people.find(person => person.id === leaderId)
  const isUpcoming = next && schedule.upcoming.some(event => event.calendarId === next.calendarId)
  const nextPending = isUpcoming && !next.isRehearsal && nextRole?.status === 'pending'
  const locked = event => excuseRequests.some(request => request.service_id === event.parentId && request.person_id === currentUser.id && ['pending', 'approved'].includes(request.status))
    || substituteRequests.some(request => request.service_id === event.parentId && request.requester_id === currentUser.id && ['open', 'filled'].includes(request.status))
  const canManage = hasPermission(currentUser, 'schedules.manage') || hasPermission(currentUser, 'services.edit')
  const allReports = hasPermission(currentUser, 'reports.view')
  const ownReports = hasPermission(currentUser, 'reports.own')
  const showAdmin = canManage || allReports || ownReports
  const managedUpcoming = schedule.upcoming.filter(event => !event.isRehearsal &&
    (canManage || primaryLeader(event, worshipRoles) === currentUser.id))
  const managedIds = new Set(managedUpcoming.map(event => event.id))
  const openSlots = quarterly.slots.filter(slot => managedIds.has(slot.serviceId) && slot.state === 'vacant')
  const needsResponses = managedUpcoming.filter(event => event.team.some(member => member.status === 'pending'))
  const readinessEvent = showAdmin && managedUpcoming.find(event => event.id === next?.parentId)
  const readiness = readinessEvent && quarterly.ready ? [
    { id: 'confirmed', label: copy('Confirmed', 'مؤكد'), rows: readinessEvent.team.filter(member => member.status === 'confirmed') },
    { id: 'pending', label: copy('Pending', 'بانتظار الرد'), rows: readinessEvent.team.filter(member => member.status === 'pending') },
    { id: 'vacant', label: copy('Unfilled', 'شاغر'), rows: openSlots.filter(slot => slot.serviceId === readinessEvent.id) },
  ] : []
  const readinessTotal = readiness.reduce((total, group) => total + group.rows.length, 0)
  const expandedGroup = readiness.find(group => group.id === readinessFilter)
  const reportServiceIds = new Set(services.filter(event => primaryLeader(event, worshipRoles) === currentUser.id).map(event => event.id))
  const scopedAttendance = attendanceSessions.filter(session => allReports || reportServiceIds.has(session.serviceId))
  const attendanceCount = scopedAttendance.reduce((total, session) => total + (attendanceRecords[session.id] || []).filter(record => record.check_in_at).length, 0)

  const updates = [
    ...quarterly.inbox.filter(item => item.recipient === currentUser.id).flatMap(item => {
      const event = services.find(service => service.id === item.serviceId)
      if (!event || !scheduleLabels[lang][item.kind]) return []
      return [{ key: `schedule-${item.id}`, date: item.createdAt, title: event.title, text: scheduleLabels[lang][item.kind], to: scheduleUrl(event) }]
    }),
    ...announcements.map(item => ({
      key: `news-${item.id}`, date: item.created_at || item.date, title: item.title, text: item.content,
      to: `/announcements#announcement-${item.id}`,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 4)

  async function confirm(event) {
    if (saving) return
    setSaving(true)
    setNotice(null)
    try {
      const result = await updateTeamMemberStatus(event.parentId || event.id, currentUser.id, 'confirmed')
      if (!result?.success || result.error) throw new Error()
      setNotice({ eventId: event.parentId, text: copy('Attendance confirmed.', 'تم تأكيد حضورك.') })
    } catch {
      setNotice({ error: true, text: copy('Couldn’t verify your response. Refresh before trying again.', 'تعذّر التحقق من ردك. حدّث الصفحة قبل المحاولة مرة أخرى.') })
    } finally {
      setSaving(false)
    }
  }

  async function refresh() {
    try {
      await loadAll()
    } catch {
      setNotice({ error: true, text: copy('Couldn’t refresh the dashboard.', 'تعذّر تحديث الرئيسية.') })
    }
  }

  const unavailable = copy('This information is temporarily unavailable.', 'هذه المعلومات غير متاحة مؤقتًا.')
  const empty = text => <p className="dashboard-muted">{text}</p>
  const sameEvent = pendingEvent => pendingEvent.id === next?.parentId && !next.isRehearsal
  const remainingPending = pending.filter(event => !sameEvent(event))
  const otherAssignments = schedule.upcoming.filter(event => !event.isRehearsal && !sameEvent(event)
    && assignment(event)?.status === 'confirmed' && personal(event))
  const eventName = event => event.isRehearsal ? copy('Rehearsal', 'بروفة') : eventType(event)[lang]
  const formatUpdateDate = value => {
    const date = parseISO(value || '')
    return isValid(date) ? dateLabel(cairoToday(date), 'd MMM') : ''
  }

  return <div className="worship-dashboard">
    <header className="dashboard-heading">
      <h1>{copy('Welcome,', 'أهلاً،')} <bdi>{currentUser.name?.trim().split(/\s+/)[0] || currentUser.email}</bdi></h1>
      <div className="dashboard-links">
        <Link to="/schedule"><CalendarDays size={16} aria-hidden="true"/>{t('schedule')}</Link>
        <Link to="/attendance"><ScanLine size={16} aria-hidden="true"/>{t('attendance')}</Link>
        <button type="button" onClick={refresh} disabled={loading} aria-label={copy('Refresh dashboard', 'تحديث الرئيسية')}><RefreshCw size={16} aria-hidden="true"/></button>
      </div>
    </header>
    {notice && <p className="dashboard-notice" role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {loading && <p className="dashboard-muted" role="status">{t('loading')}</p>}
    <div className="dashboard-grid">
      <section className="dashboard-hero" aria-labelledby="dashboard-next">
        <div className={selectedEvent ? 'dashboard-event-enter' : undefined} key={next?.calendarId}>
          <p className="dashboard-kicker"><Clock3 size={16} aria-hidden="true"/>{selectedEvent ? copy('Selected event', 'الفعالية المختارة') : copy('Next up', 'الموعد القادم')}{next && !personal(next) && <span>· {copy('Team event', 'فعالية الفريق')}</span>}</p>
          <h2 id="dashboard-next"><bdi>{next?.title || (loading ? t('loading') : dashboardErrors.services ? unavailable : copy('No upcoming assignments', 'لا توجد تكليفات قادمة'))}</bdi></h2>
          {next && <div className="dashboard-hero-info">
            <p><bdi>{eventName(next)}</bdi> · {dateTime(next)}</p>
            {nextRole && <p className="dashboard-role"><bdi>{nextRole.role}</bdi><span className={notice?.eventId === next.parentId && nextRole.status === 'confirmed' ? 'dashboard-event-enter dashboard-confirmed' : undefined} data-state={nextRole.status}>{notice?.eventId === next.parentId && nextRole.status === 'confirmed' && <Check size={14} aria-hidden="true"/>}{scheduleLabels[lang][nextRole.status]}</span></p>}
          </div>}
          <div className="dashboard-hero-actions">
            {nextPending && !locked(next)
              ? <button className="dashboard-primary" type="button" disabled={saving} onClick={() => confirm(next)}><Check size={17} aria-hidden="true"/>{copy('Confirm attendance', 'تأكيد الحضور')}</button>
              : <Link className="dashboard-primary" to={nextPending ? '/requests' : next && setlist.length ? setlistUrl(next) : next ? scheduleUrl(next) : '/schedule'}>
                {nextPending ? copy('Review requests', 'مراجعة الطلبات') : next && setlist.length ? copy('Open setlist', 'فتح قائمة الترانيم') : copy('View schedule', 'عرض الجدول')}<ArrowUpRight size={17} aria-hidden="true"/>
              </Link>}
            {nextPending && <Link className="dashboard-hero-link" to={scheduleUrl(next)}>{copy('View event', 'عرض الفعالية')}</Link>}
            {isUpcoming && renderAssignmentActions?.(nextSource, nextRole)}
          </div>
        </div>
      </section>

      <Panel title={copy('Needs your response', 'بانتظار ردك')} icon={<ClipboardList size={17} aria-hidden="true"/>} className="dashboard-responses">
        {!pending.length && empty(loading ? t('loading') : dashboardErrors.services ? unavailable : copy('You’re all caught up.', 'لا توجد تكليفات بانتظار ردك.'))}
        {pending.length > 0 && <ul className="dashboard-list">
          {nextPending && !next.isRehearsal && <li><Link to={scheduleUrl(next)}><bdi>{next.title}</bdi>{dateTime(next)}<small>{copy('Respond in event details above', 'رد من تفاصيل الفعالية أعلاه')}</small></Link></li>}
          {remainingPending.map(event => <li className="dashboard-response" key={event.id}>
            <Link to={scheduleUrl(event)}><bdi>{event.title}</bdi>{dateTime(event)}</Link>
            <div className="dashboard-item-actions">
              {locked(event)
                ? <Link to="/requests">{copy('Review requests', 'مراجعة الطلبات')}</Link>
                : <button type="button" disabled={saving} onClick={() => confirm(event)}>{t('confirm')}</button>}
              {renderAssignmentActions?.(services.find(service => service.id === event.parentId), assignment(event))}
            </div>
          </li>)}
        </ul>}
        {renderAssignmentActions && otherAssignments.length > 0 && <details className="dashboard-more">
          <summary>{copy('Manage confirmed assignments', 'إدارة التكليفات المؤكدة')}</summary>
          <ul className="dashboard-list">{otherAssignments.map(event => <li key={event.id} className="dashboard-response">
            <Link to={scheduleUrl(event)}><bdi>{event.title}</bdi>{dateTime(event)}</Link>
            <div className="dashboard-item-actions">{renderAssignmentActions(services.find(service => service.id === event.parentId), assignment(event))}</div>
          </li>)}</ul>
        </details>}
      </Panel>

      <Panel title={copy('This week', 'هذا الأسبوع')} icon={<CalendarDays size={17} aria-hidden="true"/>} className="dashboard-agenda">
        {canSeeTeam && <div className="dashboard-toggle" role="group" aria-label={t('schedule')}>
          <button type="button" aria-pressed={!teamView} onClick={() => teamView && changeAgenda(() => setTeamView(false))}>{copy('My schedule', 'جدولي')}</button>
          <button type="button" aria-pressed={teamView} onClick={() => !teamView && changeAgenda(() => setTeamView(true))}>{copy('Team schedule', 'جدول الفريق')}</button>
        </div>}
        <div className="dashboard-date-strip" role="group" aria-label={copy('Filter by day', 'تصفية حسب اليوم')}>
          <span className="dashboard-date-indicator" aria-hidden="true"
            data-visible={selectedDayIndex >= 0} style={{ '--selected-day': Math.max(selectedDayIndex, 0) }}/>
          {agenda.map(day => <button type="button" key={day.date} aria-label={dateLabel(day.date, 'EEEE, d MMMM')}
            aria-pressed={selectedDay === day.date} aria-current={day.date === schedule.today ? 'date' : undefined}
            onClick={() => changeAgenda(() => setSelectedDay(selectedDay === day.date ? null : day.date))}>
            <small>{dateLabel(day.date, 'EEE')}</small><strong>{dateLabel(day.date, 'd')}</strong>
            <span className={day.events.length ? 'dashboard-date-dot' : ''} aria-hidden="true"/>
          </button>)}
        </div>
        <div className="dashboard-agenda-content">
        <div className="dashboard-days" ref={agendaRef}>
          {visibleDays.map(day => <div className="dashboard-day" key={day.date}>
              <span className="dashboard-day-date"><time dateTime={day.date}>{dateLabel(day.date, 'EEE d')}</time>{day.date === schedule.today && <small>{copy('Today', 'اليوم')}</small>}</span>
              <ul>{day.events.map(event => <li key={event.calendarId}>
                <button type="button" className="dashboard-agenda-event"
                  aria-pressed={selectedEvent?.calendarId === event.calendarId}
                  onClick={() => {
                    setSelectedEventId(event.calendarId)
                    setReadinessFilter(null)
                  }}>
                  <bdi>{event.title}</bdi>
                  <span className="dashboard-meta"><bdi>{formatClock(event.time, isAr)}</bdi> · <bdi>{eventName(event)}</bdi> · {personal(event) ? copy('Assigned to you', 'تكليفك') : copy('Team event', 'فعالية الفريق')}</span>
                </button>
              </li>)}</ul>
            </div>)}
        {!visibleDays.length && empty(loading ? t('loading') : dashboardErrors.services ? unavailable : selectedDay ? copy('No events on this day.', 'لا توجد فعاليات في هذا اليوم.') : copy('No events on this schedule this week.', 'لا توجد فعاليات في هذا الجدول هذا الأسبوع.'))}
        </div>
        </div>
        <Link className="dashboard-panel-link" to="/schedule">{copy('View schedule', 'عرض الجدول')}<ArrowUpRight size={15} aria-hidden="true"/></Link>
      </Panel>

      <Panel title={copy('Setlist preview', 'معاينة قائمة الترانيم')} icon={<ListMusic size={17} aria-hidden="true"/>} className="dashboard-setlist">
        <div className={selectedEvent ? 'dashboard-event-enter' : undefined} key={next?.calendarId}>
          {selectedEvent && <p className="dashboard-setlist-event"><bdi>{selectedEvent.title}</bdi></p>}
          {leader && <p className="dashboard-muted">{copy('Worship leader', 'قائد التسبيح')} · <bdi>{leader.name}</bdi></p>}
          {setlist.length ? <>
            <ol className="dashboard-tracks">{setlist.slice(0, 5).map((item, index) => {
              const song = songs.find(song => song.id === item.songId) || item.song
              return <li key={item.id}><span aria-hidden="true">{index + 1}</span><bdi>{(isAr ? song?.title : song?.titleEn || song?.title) || copy('Song unavailable', 'الترنيمة غير متاحة')}</bdi>{(item.key || song?.key) && <bdi className="dashboard-key">{item.key || song.key}</bdi>}</li>
            })}</ol>
            <Link className="dashboard-panel-link" to={setlistUrl(next)}>{copy('Open full setlist', 'فتح القائمة كاملة')}<ArrowUpRight size={15} aria-hidden="true"/></Link>
          </> : empty(loading ? t('loading') : dashboardErrors.services ? unavailable : copy('No setlist available for this event.', 'لا توجد قائمة ترانيم متاحة لهذه الفعالية.'))}
        </div>
      </Panel>

      <Panel title={copy('Team updates', 'مستجدات الفريق')} icon={<Bell size={17} aria-hidden="true"/>} className="dashboard-updates">
        {updates.length ? <ul className="dashboard-list">{updates.map(item => <li key={item.key}><Link to={item.to}><bdi>{item.title}</bdi>{item.text && <small dir="auto">{item.text}</small>}<span className="dashboard-meta">{formatUpdateDate(item.date)}</span></Link></li>)}</ul>
          : empty(loading ? t('loading') : dashboardErrors.updates ? unavailable : copy('No recent team updates.', 'لا توجد مستجدات للفريق.'))}
        <Link className="dashboard-panel-link" to="/announcements">{t('announcements')}<ArrowUpRight size={15} aria-hidden="true"/></Link>
      </Panel>

      {showAdmin && <Panel title={copy('Team overview', 'نظرة على الفريق')} icon={<Users size={17} aria-hidden="true"/>} className="dashboard-overview">
        {!dashboardErrors.services && !dashboardErrors.management && readiness.length > 0 && <div className="dashboard-readiness">
          <p className="dashboard-muted">{copy('Team readiness', 'جاهزية الفريق')} · <bdi>{readinessEvent.title}</bdi></p>
          <div className="dashboard-readiness-bar" aria-hidden="true">
            {readiness.map(group => <span key={group.id} data-state={group.id} style={{ flexGrow: readinessTotal ? group.rows.length / readinessTotal : 0 }}/>)}
          </div>
          <div className="dashboard-readiness-controls">
            {readiness.map(group => <button key={group.id} type="button" aria-pressed={readinessFilter === group.id}
              onClick={() => setReadinessFilter(readinessFilter === group.id ? null : group.id)}>
              <strong>{group.rows.length}</strong>{group.label}
            </button>)}
          </div>
          {expandedGroup && <div className="dashboard-event-enter" key={expandedGroup.id}>
            {expandedGroup.rows.length ? <ul className="dashboard-readiness-roles">{expandedGroup.rows.map((row, index) =>
              <li key={row.id || row.slotId || `${row.personId}-${index}`}><bdi>{row.role}</bdi>{row.person?.name && <> · <bdi>{row.person.name}</bdi></>}</li>)}</ul>
              : empty(copy('No roles in this group.', 'لا توجد أدوار في هذه المجموعة.'))}
            <Link className="dashboard-panel-link" to={scheduleUrl(readinessEvent)}>{copy('Manage in schedule', 'إدارة في الجدول')}<ArrowUpRight size={15} aria-hidden="true"/></Link>
          </div>}
        </div>}
        {dashboardErrors.services || dashboardErrors.management ? empty(unavailable) : <ul className="dashboard-list dashboard-metrics">
          {quarterly.ready && (canManage || ownReports) && <li><Link to={openSlots.length ? scheduleUrl(managedUpcoming.find(event => event.id === openSlots[0].serviceId)) : '/schedule'}><span>{copy('Unfilled assignments', 'التكليفات الشاغرة')}</span><strong>{openSlots.length}</strong></Link></li>}
          {(canManage || ownReports) && <li><Link to={needsResponses.length ? scheduleUrl(needsResponses[0]) : '/schedule'}><span>{copy('Pending team responses', 'ردود الفريق المعلقة')}</span><strong>{needsResponses.reduce((total, event) => total + event.team.filter(member => member.status === 'pending').length, 0)}</strong></Link></li>}
          {(allReports || ownReports) && <li><Link to="/reports?tab=attendance"><span>{copy('Recorded check-ins', 'الحضور المسجل')}</span><strong>{dashboardErrors.attendance ? '—' : attendanceCount}</strong></Link></li>}
        </ul>}
      </Panel>}
    </div>
  </div>
}
