import test from 'node:test'
import assert from 'node:assert/strict'
import { canManageWorship, getAccessLevel, getUserRoles, hasPermission, isAdminUser, isSuperAdminUser, normalizeRoleName } from '../src/lib/permissions.js'

test('worship roles do not grant system permissions',()=>{
  const user={roles:['Worship Leader'],accessLevel:'member',status:'active'}
  assert.equal(canManageWorship(user),false)
  assert.equal(isAdminUser(user),false)
})

test('leader access is explicit and is not admin access',()=>{
  const user={access_level:'leader',status:'active'}
  assert.equal(canManageWorship(user),true)
  assert.equal(isAdminUser(user),false)
})

test('super admin receives all permissions',()=>{
  const user={accessLevel:'super_admin',status:'active'}
  assert.equal(isSuperAdminUser(user),true)
  assert.equal(hasPermission(user,'permissions.manage'),true)
})

test('database role assignments take precedence over legacy role strings',()=>{
  const user={roles:['Legacy'],roleAssignments:[{worshipRole:{name:'Keyboard'}},{worshipRole:{name:'Vocal'}}]}
  assert.deepEqual(getUserRoles(user),['Keyboard','Vocal'])
})

test('legacy admin and normalized role names remain compatible',()=>{
  assert.equal(getAccessLevel({is_admin:true}),'admin')
  assert.equal(normalizeRoleName('  PIANO   Player '),'piano player')
})
