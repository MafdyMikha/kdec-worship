import test from 'node:test'
import assert from 'node:assert/strict'
import { addMinutesToTime, attendanceOccurrenceDate, attendanceTiming } from '../src/lib/attendance.js'

const cairo = 'Africa/Cairo'
const session = {
  session_date:'2026-08-10',
  session_time:'16:00',
  end_time:'18:00',
  repeatable:false,
}

test('a standalone attendance session uses its explicit date', () => {
  assert.equal(attendanceOccurrenceDate(session, cairo), '2026-08-10')
})

test('arrival timing distinguishes early, on-time grace, and late check-ins', () => {
  assert.equal(attendanceTiming({ occurrence_date:'2026-08-10', check_in_at:'2026-08-10T12:50:00Z' }, session, cairo, 15).arrival, 'early')
  assert.equal(attendanceTiming({ occurrence_date:'2026-08-10', check_in_at:'2026-08-10T13:10:00Z' }, session, cairo, 15).arrival, 'on_time')
  assert.equal(attendanceTiming({ occurrence_date:'2026-08-10', check_in_at:'2026-08-10T13:16:00Z' }, session, cairo, 15).arrival, 'late')
})

test('departure timing distinguishes early checkout from normal completion', () => {
  const early = { occurrence_date:'2026-08-10', check_in_at:'2026-08-10T12:50:00Z', check_out_at:'2026-08-10T14:59:00Z' }
  const normal = { ...early, check_out_at:'2026-08-10T15:00:00Z' }
  assert.equal(attendanceTiming(early, session, cairo, 15).departure, 'early')
  assert.equal(attendanceTiming(normal, session, cairo, 15).departure, 'normal')
})

test('overnight sessions treat an after-midnight checkout as the scheduled end', () => {
  const overnight = { ...session, session_time:'23:00', end_time:'01:00' }
  const record = { occurrence_date:'2026-08-10', check_in_at:'2026-08-10T19:50:00Z', check_out_at:'2026-08-10T22:00:00Z' }
  assert.equal(attendanceTiming(record, overnight, cairo, 15).departure, 'normal')
})

test('default end-time suggestion wraps across midnight', () => {
  assert.equal(addMinutesToTime('16:00', 120), '18:00')
  assert.equal(addMinutesToTime('23:30', 120), '01:30')
})
