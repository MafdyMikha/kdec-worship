import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeAuthenticatedProfile } from '../src/lib/authProfile.js'

test('auth metadata cannot overwrite worship roles or profile authorization', () => {
  const merged = mergeAuthenticatedProfile(
    { id:'profile-id', email:'old@example.com', role:'Vocalist', roles:['Vocalist'], isAdmin:false },
    { id:'auth-id', email:'live@example.com', role:'authenticated', app_metadata:{ role:'service_role' } },
  )

  assert.equal(merged.id, 'auth-id')
  assert.equal(merged.personId, 'auth-id')
  assert.equal(merged.email, 'live@example.com')
  assert.equal(merged.role, 'Vocalist')
  assert.deepEqual(merged.roles, ['Vocalist'])
  assert.equal(merged.isAdmin, false)
  assert.equal('app_metadata' in merged, false)
})
