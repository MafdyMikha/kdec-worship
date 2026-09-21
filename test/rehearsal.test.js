import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareRehearsal, rehearsalLocationUrl } from '../src/lib/rehearsal.js'

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
