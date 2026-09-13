import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureDemoWeeklyServices, weeklyServiceTitle, isYouthMeetingDate } from '../src/lib/weeklyServices.js'

test('the rolling window contains twelve Youth Meetings only', () => {
  const rows = ensureDemoWeeklyServices([], '2026-09-14')
  assert.equal(rows.length, 12)
  assert.deepEqual(rows.filter(row => row.date === '2026-09-18').map(row => row.time).sort(), ['18:00'])
  assert.ok(rows.every(row => row.weeklyTemplateKey === 'youth'))
  assert.ok(rows.every(row => row.date >= '2026-09-14' && row.date < '2026-12-07'))
})

test('reload preserves preparation, cancellation, empty assignments and extra meetings', () => {
  const rows = ensureDemoWeeklyServices([], '2026-12-28')
  rows[0].team.push({ personId:'member-1' })
  rows[0].practice = { enabled:true, date:'2026-12-28', time:'17:00' }
  rows[0].soundcheckTime = '18:00'
  rows[1].status = 'cancelled'
  const extra = { id:'extra', title:'Special meeting', date:rows[0].date, time:rows[0].time }
  const reloaded = ensureDemoWeeklyServices(JSON.parse(JSON.stringify([...rows, extra])), '2026-12-28')
  assert.deepEqual(reloaded, [...rows, extra])
  assert.ok(rows.slice(1).every(row => row.team.length === 0 && row.practice === null && row.soundcheckTime === null))
  const advanced = ensureDemoWeeklyServices(reloaded, '2027-01-04')
  assert.equal(advanced.length, reloaded.length + 1)
  assert.equal(new Set(advanced.map(row => row.id)).size, advanced.length)
})

test('weekly titles support Arabic and extra titles remain unchanged', () => {
  assert.equal(weeklyServiceTitle({ weeklyTemplateKey:'youth' }, true), 'اجتماع الشباب')
  assert.equal(weeklyServiceTitle({ weeklyTemplateKey:'prayer' }, false), 'Prayer Meeting')
  assert.equal(weeklyServiceTitle({ title:'Extra' }, true), 'Extra')
})

test('Youth date selection accepts Fridays and rejects invalid dates', () => {
  assert.equal(isYouthMeetingDate('2027-01-01'), true)
  assert.equal(isYouthMeetingDate('2026-09-18'), true)
  for (const date of ['2026-09-15','2026-02-30','invalid','','2026-9-18']) assert.equal(isYouthMeetingDate(date), false)
})
