import test from 'node:test'
import assert from 'node:assert/strict'
import { MAJOR_KEYS, MINOR_KEYS, MUSICAL_KEYS } from '../src/lib/musicKeys.js'
import { normalizeImportedSong, validateImportedSong } from '../src/lib/songImport.js'

test('every selectable major spelling has a matching minor spelling',()=>{
  assert.equal(MAJOR_KEYS.length,17)
  assert.equal(MINOR_KEYS.length,17)
  assert.equal(MUSICAL_KEYS.length,34)
  for(const major of MAJOR_KEYS) assert.ok(MINOR_KEYS.includes(`${major}m`),`${major}m is missing`)
})

test('previously missing minor keys are accepted by song imports',()=>{
  for(const key of ['Cm','Dbm','D#m','Ebm','Fm','Gbm','G#m','Abm','A#m','Bbm']) {
    const song=normalizeImportedSong({title:'Song',key})
    assert.deepEqual(validateImportedSong(song),[])
  }
})
