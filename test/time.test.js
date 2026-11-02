import test from 'node:test'
import assert from 'node:assert/strict'
import { TIME_FIELDS, formatClock, timeParts, time24, updateTimePart } from '../src/lib/time.js'
import { attendanceSchedule, attendanceSnapshot } from '../src/lib/attendancePolicy.js'
import { formatAttendanceTime } from '../src/lib/attendanceReport.js'

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

test('picker fields are ordered Hour : Minute AM/PM with separate option ranges', () => {
  assert.deepEqual(TIME_FIELDS.map(field => field.key), ['hour', 'minute', 'period'])
  assert.deepEqual(TIME_FIELDS[0].options, ['1','2','3','4','5','6','7','8','9','10','11','12'])
  assert.deepEqual(TIME_FIELDS[1].options, Array.from({length:60}, (_, i) => String(i).padStart(2, '0')))
  assert.deepEqual(TIME_FIELDS[2].options, ['AM', 'PM'])
  for (const minute of ['00', '22', '31', '59']) {
    assert.ok(!TIME_FIELDS[0].options.includes(minute))
    assert.ok(TIME_FIELDS[1].options.includes(minute))
  }
})

test('midnight, noon, PM and last-minute selections have explicit 24-hour storage', () => {
  for (const [hour, minute, period, stored] of [
    ['12','00','AM','00:00'], ['12','00','PM','12:00'],
    ['4','30','PM','16:30'], ['11','59','PM','23:59'],
  ]) {
    assert.equal(time24(hour, minute, period), stored)
    assert.deepEqual(timeParts(`${stored}:00`), {hour, minute, period})
  }
  for (const [hour, minute, period] of [
    ['00','00','AM'], ['22','00','PM'], ['31','00','AM'], ['13','00','AM'],
    ['1','60','AM'], ['1','5','AM'], ['1','00',''], ['','00','AM'],
  ]) assert.equal(time24(hour, minute, period), '')
})

test('changing a control updates only its mapped field, including minute-like values', () => {
  assert.equal(updateTimePart('16:30', 'hour', '12'), '12:30')
  assert.equal(updateTimePart('16:30', 'minute', '00'), '16:00')
  assert.equal(updateTimePart('16:30', 'minute', '22'), '16:22')
  assert.equal(updateTimePart('16:30', 'minute', '31'), '16:31')
  assert.equal(updateTimePart('16:30', 'period', 'AM'), '04:30')
  assert.equal(updateTimePart('00:00:00', 'minute', '01'), '00:01')
  assert.equal(updateTimePart('', 'hour', '4'), '04:00')
  assert.equal(updateTimePart('', 'minute', '31'), '00:31')
  assert.equal(updateTimePart('', 'period', 'PM'), '12:00')
  assert.equal(updateTimePart('16:30', 'hour', '22'), '16:30')
  assert.equal(updateTimePart('16:30', 'unknown', '11'), '16:30')
})

test('stored schedule rehydrates for editing without changing Cairo overnight timing or tolerance', () => {
  // Exercise the existing snake_case persistence boundary without a browser or service.
  const session = JSON.parse(JSON.stringify({
    session_date:'2026-11-10', session_end_date:'2026-11-11',
    session_time:time24('11', '59', 'PM'), end_time:time24('12', '31', 'AM'),
    effective_late_minutes:5,
  }))
  assert.deepEqual(timeParts(session.session_time), {hour:'11', minute:'59', period:'PM'})
  assert.deepEqual(timeParts(session.end_time), {hour:'12', minute:'31', period:'AM'})
  assert.deepEqual(attendanceSchedule(session), {
    start:new Date('2026-11-10T21:59:00Z'), end:new Date('2026-11-10T22:31:00Z'),
  })
  session.end_time = updateTimePart(session.end_time, 'minute', '32')
  assert.equal(session.end_time, '00:32')
  const record = attendanceSnapshot({check_in_at:'2026-11-10T22:03:00Z'}, session)
  assert.equal(record.arrival_status, 'on_time')
  assert.equal(record.scheduled_end_at, '2026-11-10T22:32:00.000Z')
  const inferred = {...session, session_end_date:null}
  assert.deepEqual(attendanceSchedule(inferred), attendanceSchedule(session))
})

test('attendance cards, details, previews and QR text share localized 12-hour formatting', () => {
  for (const [stored, text] of [['00:00','12:00 AM'], ['12:00','12:00 PM'], ['16:30','4:30 PM'], ['23:59','11:59 PM']]) {
    assert.equal(formatAttendanceTime(stored), text)
    assert.equal(formatAttendanceTime(`${stored}:00`), text)
    assert.equal(formatAttendanceTime(stored, true), formatClock(stored, true))
  }
  assert.equal(formatAttendanceTime('25:00'), '—')
  assert.equal(formatClock('00:00', true), '١٢:٠٠ ص')
  assert.equal(formatClock('12:00', true), '١٢:٠٠ م')
  assert.equal(formatClock('16:30', true), '٤:٣٠ م')
})
