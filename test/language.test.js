import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveLanguage } from '../src/lib/language.js'

test('English is the default for new or invalid language preferences', () => {
  for (const saved of [null, undefined, '', 'fr']) {
    assert.equal(resolveLanguage(saved), 'en')
  }
})

test('saved English and Arabic preferences survive reload', () => {
  assert.equal(resolveLanguage('en'), 'en')
  assert.equal(resolveLanguage('ar'), 'ar')
})
