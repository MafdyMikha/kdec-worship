import test from 'node:test'
import assert from 'node:assert/strict'

import { generateOccurrences } from '../src/lib/recurrence.js'

const BASE = { id:'series-1', title:'Sunday Worship', date:'2026-01-04', time:'10:00', type:'Sunday Service' }

test('weekly and biweekly recurrence generate the requested follow-up count', () => {
  assert.deepEqual(
    generateOccurrences(BASE, { enabled:true, frequency:'weekly', count:3 }).map(item => item.date),
    ['2026-01-11','2026-01-18','2026-01-25'],
  )
  assert.deepEqual(
    generateOccurrences(BASE, { enabled:true, frequency:'biweekly', count:2 }).map(item => item.date),
    ['2026-01-18','2026-02-01'],
  )
})

test('monthly recurrence stays anchored to the original day after a short month', () => {
  const dates = generateOccurrences({ ...BASE, date:'2026-01-31' }, { enabled:true, frequency:'monthly', count:3 }).map(item => item.date)
  assert.deepEqual(dates, ['2026-02-28','2026-03-31','2026-04-30'])
})

test('monthly extensions keep the original anchor after existing occurrences', () => {
  const dates = generateOccurrences(
    { ...BASE, date:'2026-01-31' },
    { enabled:true, frequency:'monthly', count:3, startIndex:3 },
  ).map(item => item.date)
  assert.deepEqual(dates, ['2026-05-31','2026-06-30','2026-07-31'])
})

test('end date truncates recurrence without including a later occurrence', () => {
  const dates = generateOccurrences(BASE, { enabled:true, frequency:'weekly', count:10, endDate:'2026-01-20' }).map(item => item.date)
  assert.deepEqual(dates, ['2026-01-11','2026-01-18'])
})

test('disabled and zero-count recurrence return no follow-up occurrences', () => {
  assert.deepEqual(generateOccurrences(BASE, { enabled:false, frequency:'weekly', count:4 }), [])
  assert.deepEqual(generateOccurrences(BASE, { enabled:true, frequency:'weekly', count:0 }), [])
})
