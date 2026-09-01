import test from 'node:test'
import assert from 'node:assert/strict'
import { isBlankText, isValidEmail, normalizeEmail, normalizeRequiredText } from '../src/lib/validation.js'

test('required text rejects ASCII and Unicode whitespace-only values',()=>{
  assert.equal(isBlankText(' \t\n '),true)
  assert.equal(isBlankText('\u00a0\u2003'),true)
  assert.equal(isBlankText(' ترنيمة '),false)
})

test('required text is normalized and trimmed before persistence',()=>{
  assert.equal(normalizeRequiredText('  Sunday\n  Service  '),'Sunday Service')
})

test('email validation rejects malformed addresses and normalizes valid ones',()=>{
  for(const value of ['', 'abc', '@x.com', 'a@', 'a@b', 'a @b.com', 'a@b .com']) assert.equal(isValidEmail(value),false,value)
  assert.equal(isValidEmail(' Person@Example.COM '),true)
  assert.equal(normalizeEmail(' Person@Example.COM '),'person@example.com')
})
