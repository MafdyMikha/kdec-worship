import test from 'node:test'
import assert from 'node:assert/strict'
import { ensureDemoWeeklyServices, weeklyServiceTitle, isYouthMeetingDate } from '../src/lib/weeklyServices.js'

test('loading and reloading never generates predefined meetings', () => {
  assert.deepEqual(ensureDemoWeeklyServices([], '2026-09-14'), [])
  const rows=[{id:'youth',weeklyTemplateKey:'youth',date:'2026-10-30',team:[],practice:null},{id:'manual',title:'Conference',date:'2026-11-02',status:'cancelled'}]
  assert.deepEqual(ensureDemoWeeklyServices(JSON.parse(JSON.stringify(rows)), '2027-01-01'),rows)
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
