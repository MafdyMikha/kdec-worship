import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardSchedule, resolveDashboardEvent } from '../src/lib/dashboard.js'

const now = new Date('2026-11-15T08:00:00Z')
const event = (id, fields = {}) => ({
  id, date: '2026-11-15', time: '16:00', endTime: '18:00',
  status: 'scheduled', publishedAt: '2026-11-01', team: [], ...fields,
})
const assigned = status => [{ personId: 'me', status }]

test('next personal event respects Cairo time and can be a rehearsal', () => {
  const rehearsal = event('service', { date: '2026-11-16', team: assigned('pending'),
    practice: { enabled: true, date: '2026-11-15', time: '13:00' } })
  const schedule = buildDashboardSchedule([
    rehearsal, event('past', { time: '08:00', endTime: '09:00', team: assigned('pending') }),
    event('team', { time: '12:00' }), event('draft', { publishedAt: null, team: assigned('pending') }),
  ], 'me', now)
  assert.equal(schedule.next.calendarId, 'service:rehearsal')
  assert.deepEqual(schedule.pending.map(item => item.id), ['service'])
  assert.equal(schedule.days[0].date, '2026-11-15')
})

test('team fallback excludes cancelled, archived and draft events', () => {
  const schedule = buildDashboardSchedule([
    event('cancelled', { status: 'cancelled' }), event('archived', { archivedAt: '2026-11-14' }),
    event('draft', { publishedAt: null }), event('team'),
  ], 'me', now)
  assert.equal(schedule.nextPersonal, undefined)
  assert.equal(schedule.next.id, 'team')
  assert.deepEqual(schedule.pending, [])
})

test('declined assignments remain team events and overnight shifts cover both days', () => {
  const schedule = buildDashboardSchedule([
    event('declined', { team: assigned('declined') }),
    event('shift', { time: '23:00', endDate: '2026-11-16', endTime: '01:00', participantIds: ['me'] }),
  ], 'me', now)
  assert.equal(schedule.next.id, 'shift')
  assert.equal(schedule.personal(schedule.upcoming[0]), false)
  assert.equal(schedule.days[1].events[0].id, 'shift')
})

test('an empty selected day hides the upcoming event until the filter clears', () => {
  const upcoming = event('upcoming')
  assert.equal(resolveDashboardEvent([], '2026-11-16', null, upcoming).next, null)
  assert.equal(resolveDashboardEvent([], null, null, upcoming).next, upcoming)
})

test('overnight events remain visible after midnight while response eligibility follows the server date', () => {
  const shift = event('shift', {
    time: '23:00', endDate: '2026-11-16', endTime: '01:00',
    team: assigned('pending'),
  })
  const beforeMidnight = new Date('2026-11-15T21:59:00Z')
  const midnight = new Date('2026-11-15T22:00:00Z')
  const shiftSlot = { personId: 'me', serviceId: 'shift' }

  assert.deepEqual(buildDashboardSchedule([shift], 'me', beforeMidnight).pending.map(item => item.id), ['shift'])
  const cairoSchedule = buildDashboardSchedule([shift], 'me', midnight)
  assert.equal(cairoSchedule.next.id, 'shift')
  assert.deepEqual(cairoSchedule.pending, [])

  const directAssignment = buildDashboardSchedule([shift], 'me', midnight, { timezone: 'UTC' })
  assert.deepEqual(directAssignment.pending.map(item => item.id), ['shift'])
  const quarterlyAssignment = buildDashboardSchedule([shift], 'me', midnight, { timezone: 'UTC', slots: [shiftSlot] })
  assert.deepEqual(quarterlyAssignment.pending, [])
})
