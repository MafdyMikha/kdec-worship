import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAttendanceReport } from '../src/lib/attendanceReport.js'
import { buildExcelWorkbook } from '../src/lib/excelExport.js'

test('attendance report joins sessions, members, and timing classifications', () => {
  const sessions = [{ id:'s1', name:'Sunday Service', label:'Service', sessionDate:'2026-08-09', sessionTime:'10:00', endTime:'12:00' }]
  const people = [{ id:'p1', name:'Mafdy Mikha', role:'Leader' }]
  const recordsBySession = { s1:[{ id:'r1', session_id:'s1', person_id:'p1', occurrence_date:'2026-08-09', check_in_at:'2026-08-09T06:55:00.000Z', check_out_at:'2026-08-09T10:05:00.000Z', status:'present' }] }
  const report = buildAttendanceReport({ sessions, people, recordsBySession, timezone:'Africa/Cairo', lateMinutes:5 })
  assert.equal(report.rows[0].sessionName, 'Sunday Service')
  assert.equal(report.rows[0].personName, 'Mafdy Mikha')
  assert.equal(report.rows[0].arrival, 'early')
  assert.equal(report.rows[0].departure, 'normal')
  assert.deepEqual(report.summaries[0], { person:people[0], records:1, early:1, onTime:0, late:0, earlyCheckout:0, normalCheckout:1 })
})

test('Excel workbook escapes values and creates separate worksheets', () => {
  const xml = buildExcelWorkbook([
    { name:'Attendance', columns:['Name'], rows:[["Mafdy & <Team>"]] },
    { name:'Summary', columns:['Count'], rows:[[2]] },
  ])
  assert.match(xml, /Worksheet ss:Name="Attendance"/)
  assert.match(xml, /Worksheet ss:Name="Summary"/)
  assert.match(xml, /Mafdy &amp; &lt;Team&gt;/)
  assert.match(xml, /ss:Type="Number">2/)
})
