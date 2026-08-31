import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const storeSource = readFileSync(new URL('../src/store/useStore.jsx', import.meta.url), 'utf8')

test('profile role embeds name the member foreign key to avoid PostgREST ambiguity', () => {
  const hintedRelation = 'profile_worship_roles!profile_worship_roles_profile_id_fkey'
  assert.equal(storeSource.split(hintedRelation).length - 1, 2)
  assert.doesNotMatch(storeSource, /roleAssignments:profile_worship_roles\(/)
})
