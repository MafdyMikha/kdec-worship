import test from 'node:test'
import assert from 'node:assert/strict'
import { getSongLyrics, getSongProChords, prepareSongForm, songToForm } from '../src/lib/songLibrary.js'

test('song editor preserves Arabic lyrics, mixed chords, spacing, and line breaks',()=>{
  const lyrics='[مقطع 1]\nأنت صالح C\n\n[قرار]\nللأبد'
  const chords='[Verse 1]\nG       C/E\nأنت صالح\nF#m  Bb  Gsus4  Am7'
  const prepared=prepareSongForm({title:'أنت صالح',key:'G',bpm:72,timeSignature:'4/4',language:'ar',lyrics,proChords:chords,tagsText:'تسبيح، صلاح الله'})
  assert.deepEqual(prepared.errors,[])
  assert.equal(prepared.value.lyrics,lyrics)
  assert.equal(prepared.value.proChords,chords)
  assert.deepEqual(prepared.value.themes,['تسبيح','صلاح الله'])
  assert.deepEqual(prepared.value.sequence,['مقطع 1','قرار'])
})

test('song editor rejects invalid BPM, key, and time signature',()=>{
  const prepared=prepareSongForm({title:'Song',key:'H',bpm:18,timeSignature:'four',language:'en'})
  assert.equal(prepared.errors.length,3)
})

test('song content helpers read primary lyrics and the latest inline chord version',()=>{
  const song={lyricVersions:[{content:'lyrics',isPrimary:true}],charts:[{isInline:true,versions:[{version:1,rawContent:'G'},{version:2,rawContent:'C'}]}]}
  assert.equal(getSongLyrics(song),'lyrics')
  assert.equal(getSongProChords(song),'C')
  assert.equal(songToForm(song).proChords,'C')
})
