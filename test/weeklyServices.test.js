import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureDemoWeeklyServices, weeklyServiceTitle } from '../src/lib/weeklyServices.js'

test('the rolling window contains twelve of each fixed weekly meeting', () => {
  const rows = ensureDemoWeeklyServices([], '2026-09-14')
  assert.equal(rows.length, 48)
  assert.deepEqual(rows.filter(row => row.date === '2026-09-18').map(row => row.time).sort(), ['11:00','14:00','18:00'])
  assert.equal(rows.find(row => row.date === '2026-09-15').time, '19:00')
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
  assert.equal(advanced.length, reloaded.length + 4)
  assert.equal(new Set(advanced.map(row => row.id)).size, advanced.length)
})

test('weekly titles support Arabic and extra titles remain unchanged', () => {
  assert.equal(weeklyServiceTitle({ weeklyTemplateKey:'youth' }, true), 'اجتماع الشباب')
  assert.equal(weeklyServiceTitle({ weeklyTemplateKey:'prayer' }, false), 'Prayer Meeting')
  assert.equal(weeklyServiceTitle({ title:'Extra' }, true), 'Extra')
})
