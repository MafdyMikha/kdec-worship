import test from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_ACCOUNTS, getDemoAccount } from '../src/lib/demoAccounts.js'

test('demo choices map to distinct admin, leader, and ordinary-member accounts',()=>{
  assert.equal(getDemoAccount('admin').accessLevel,'super_admin')
  assert.equal(getDemoAccount('leader').accessLevel,'leader')
  assert.equal(getDemoAccount('member').accessLevel,'member')
  assert.equal(new Set(Object.values(DEMO_ACCOUNTS).map(account=>account.email)).size,3)
})
