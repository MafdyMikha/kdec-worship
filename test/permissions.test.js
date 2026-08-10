import test from 'node:test'
import assert from 'node:assert/strict'

import { canManageWorship, getUserRoles, isAdminUser } from '../src/lib/permissions.js'

test('getUserRoles prefers a populated roles array', () => {
  const roles = ['Vocalist', 'Worship Leader']

  assert.deepEqual(getUserRoles({ role: 'Drummer', roles }), roles)
})

test('getUserRoles falls back to the legacy primary role', () => {
  assert.deepEqual(getUserRoles({ role: 'Pianist/Keys', roles: [] }), ['Pianist/Keys'])
  assert.deepEqual(getUserRoles({ role: 'Bass Guitar' }), ['Bass Guitar'])
  assert.deepEqual(getUserRoles(null), [])
})

test('isAdminUser supports normalized and database-shaped profiles', () => {
  assert.equal(isAdminUser({ isAdmin: true }), true)
  assert.equal(isAdminUser({ is_admin: true }), true)
  assert.equal(isAdminUser({ isAdmin: false, is_admin: false }), false)
  assert.equal(isAdminUser(undefined), false)
})

test('canManageWorship grants access to admins and leadership roles', () => {
  assert.equal(canManageWorship({ isAdmin: true, role: 'Vocalist' }), true)
  assert.equal(canManageWorship({ role: 'Worship Leader' }), true)
  assert.equal(canManageWorship({ role: 'Vocalist', roles: ['Vocalist', 'Music Director'] }), true)
})

test('canManageWorship rejects unrelated roles and missing users', () => {
  assert.equal(canManageWorship({ role: 'Vocalist', roles: ['Vocalist', 'Drummer'] }), false)
  assert.equal(canManageWorship(null), false)
})
