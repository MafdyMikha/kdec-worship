import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareRehearsal, rehearsalLocationUrl, rehearsalBeforeService } from '../src/lib/rehearsal.js'

test('rehearsal must precede service, including same-day and midnight boundaries', () => {
  const service = {date:'2026-09-25', time:'18:00'}
  const check = (date,time) => rehearsalBeforeService({enabled:true,date,time},service)
  assert.equal(check('2026-09-24','23:59'), true)
  assert.equal(check('2026-09-25','17:59'), true)
  assert.equal(check('2026-09-25','18:00'), false)
  assert.equal(check('2026-09-25','18:01'), false)
  assert.equal(check('2026-09-26','00:00'), false)
  assert.equal(check('2026-02-30','12:00'), false)
  assert.equal(check('2026-09-24',''), false)
  assert.equal(rehearsalBeforeService({enabled:false},service), true)
  assert.equal(rehearsalBeforeService({enabled:true,date:service.date,time:'00:00'}, {...service,time:'00:00'}), false)
})

test('location links only allow safe web URLs', () => {
  assert.equal(rehearsalLocationUrl(' https://maps.google.com/place '), 'https://maps.google.com/place')
  for (const value of ['', 'javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:pass@example.com', 'not a link']) assert.equal(rehearsalLocationUrl(value), '')
})

test('rehearsal edits preserve existing attendance and survive JSON persistence', () => {
  const attendance = [{ personId:'member1', status:'attending' }]
  const result = prepareRehearsal({ attendance }, { enabled:true, date:'2026-09-25', time:'18:00', location:' Church hall ', locationUrl:'https://example.com/map', notes:'Bring charts' })
  assert.equal(result.location, 'Church hall')
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
  assert.deepEqual(prepareRehearsal(result, { ...result, enabled:false }).attendance, attendance)
})
