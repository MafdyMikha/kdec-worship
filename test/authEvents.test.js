import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldReloadAuthProfile } from '../src/lib/authEvents.js'

test('the initial session loads the signed-in profile',()=>{
  assert.equal(shouldReloadAuthProfile('INITIAL_SESSION',null,'user-1'),true)
})

test('a repeated SIGNED_IN event for the same user does not reload the application',()=>{
  assert.equal(shouldReloadAuthProfile('SIGNED_IN','user-1','user-1'),false)
})

test('a real account change reloads the new profile',()=>{
  assert.equal(shouldReloadAuthProfile('SIGNED_IN','user-1','user-2'),true)
})

test('token refresh and user update events keep the current screen mounted',()=>{
  assert.equal(shouldReloadAuthProfile('TOKEN_REFRESHED','user-1','user-1'),false)
  assert.equal(shouldReloadAuthProfile('USER_UPDATED','user-1','user-1'),false)
})
