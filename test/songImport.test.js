import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSongImportPreview, buildSongTemplateCsv, detectSongLanguage, findDuplicateSong,
  matchChordFile, normalizeSongIdentity, parseChordPro, parseDelimitedText,
  parseLyricsSections, parsePastedSongs, rowsToSongImports, slugifySongPath,
} from '../src/lib/songImport.js'

test('CSV parsing preserves quoted multiline Arabic lyrics', () => {
  const rows = parseDelimitedText('title,lyrics\nأنت صالح,"[مقطع 1]\nأنت صالح، في كل حين"')
  const songs = rowsToSongImports(rows)
  assert.equal(songs[0].title, 'أنت صالح')
  assert.equal(songs[0].lyrics, '[مقطع 1]\nأنت صالح، في كل حين')
  assert.equal(songs[0].language, 'ar')
})

test('pasted song blocks preserve formatting and detect languages', () => {
  const songs = parsePastedSongs('TITLE: Worthy\nLANGUAGE: English\n\nLYRICS:\n[Verse 1]\nYou are worthy\n---\nTITLE: إلهي صالح\nLYRICS:\n[قرار]\nأنت أمين')
  assert.equal(songs.length, 2)
  assert.equal(songs[0].lyrics, '[Verse 1]\nYou are worthy')
  assert.equal(songs[1].language, 'ar')
})

test('lyrics sections normalize English and Arabic labels without changing raw text', () => {
  const content = '[Verse 1]\nYou give life\n\n[قرار]\nأنت أمين'
  const parsed = parseLyricsSections(content)
  assert.equal(parsed.raw, content)
  assert.deepEqual(parsed.sections.map(section => [section.type, section.label]), [['verse','Verse 1'],['chorus','قرار']])
})

test('Arabic duplicate comparison ignores tashkeel and common letter differences', () => {
  assert.equal(normalizeSongIdentity('يَسُوع حَبِيبِي'), normalizeSongIdentity('يسوع حبيبى'))
  const match = findDuplicateSong({ title:'يَسُوع حَبِيبِي' }, [{ id:'1', title:'يسوع حبيبى' }])
  assert.equal(match.confidence, 'exact')
})

test('preview isolates invalid rows and defaults duplicates to skip', () => {
  const preview = buildSongImportPreview([
    { title:'Existing', key:'G', timeSignature:'4/4', bpm:72 },
    { title:'', key:'G', timeSignature:'4/4', bpm:null },
  ], [{ id:'s1', title:'Existing' }])
  assert.deepEqual(preview.map(row => [row.status,row.action]), [['existing','skip'],['error','skip']])
})

test('ChordPro parser preserves Arabic lyrics and separates LTR chord symbols', () => {
  const parsed = parseChordPro('{title: أنت صالح}\n{key: G}\n\n[G]أنت صالح في كل [C]حين')
  assert.equal(parsed.metadata.title, 'أنت صالح')
  assert.equal(parsed.metadata.key, 'G')
  assert.deepEqual(parsed.lines.at(-1).segments.filter(segment => segment.type === 'chord').map(segment => segment.text), ['G','C'])
  assert.equal(parsed.lines.at(-1).direction, 'rtl')
})

test('chart matching uses normalized filenames and detects musical key', () => {
  const result = matchChordFile({ fileName:'Worthy-of-It-All-G.pdf' }, [{ id:'s1', title:'Worthy of It All', author:'David Brymer' }])
  assert.equal(result.matchedSongId, 's1')
  assert.equal(result.detectedKey, 'G')
  assert.equal(result.confidence, 'exact')
})

test('Arabic paths are stable and template includes UTF-8 Arabic sample', () => {
  assert.match(slugifySongPath('أنت صالح'), /^song-/)
  assert.match(buildSongTemplateCsv(), /أنت صالح/)
  assert.equal(detectSongLanguage('Hello يسوع'), 'both')
})
