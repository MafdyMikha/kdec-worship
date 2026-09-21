import test from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, timeParts, time24 } from '../src/lib/time.js'

test('12-hour formatting handles midnight, noon and seconds', () => {
  assert.equal(formatClock('00:00'), '12:00 AM')
  assert.equal(formatClock('12:00'), '12:00 PM')
  assert.equal(formatClock('18:30:00'), '6:30 PM')
  assert.equal(formatClock('09:05'), '9:05 AM')
  assert.equal(timeParts('25:00'), null)
  assert.equal(timeParts('12:60'), null)
  assert.equal(formatClock(''), '—')
})

test('all 1440 minute choices round trip without changing scheduled time', () => {
  for(let h=0;h<24;h++) for(let m=0;m<60;m++) {
    const original = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
    const {hour,minute,period} = timeParts(original)
    assert.equal(time24(hour,minute,period), original)
  }
})
