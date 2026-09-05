import { MUSICAL_KEYS } from './musicKeys.js'

export const SONG_IMPORT_HEADERS = [
  'title','arabic_title','artist','default_key','bpm','time_signature',
  'language','ccli_number','lyrics','pro_chords','tags','notes',
]

const HEADER_ALIASES = {
  title:['title','song title','english title','name','song'],
  arabicTitle:['arabic title','arabic_title','title ar','title_ar','العنوان العربي','اسم الترنيمة'],
  artist:['artist','artist / worship band','worship band','band','author','المؤلف','الفريق'],
  key:['default key','default_key','original key','key','الطبقة'],
  bpm:['bpm','tempo','الإيقاع'],
  timeSignature:['time signature','time_signature','meter','الميزان'],
  language:['language','lang','اللغة'],
  ccliNumber:['ccli','ccli number','ccli_number'],
  lyrics:['lyrics','words','كلمات','الكلمات'],
  proChords:['pro chords','pro_chords','chords','chord sheet','chord_sheet','الكوردات','الأكوردات'],
  tags:['tags','themes','keywords','تصنيفات'],
  notes:['notes','note','ملاحظات'],
}

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
const ARABIC_CHARACTER = /[\u0600-\u06FF]/g
const LATIN_CHARACTER = /[A-Za-z]/g
const MOJIBAKE = /(?:Ø.|Ù.|Ã.|Â.){2,}/
const VALID_KEYS = new Set(MUSICAL_KEYS)
const LANGUAGE_VALUES = new Map([
  ['ar','ar'],['arabic','ar'],['عربي','ar'],['العربية','ar'],
  ['en','en'],['english','en'],['إنجليزي','en'],['الإنجليزية','en'],
  ['both','both'],['bilingual','both'],['arabic / english','both'],['arabic/english','both'],['عربي / إنجليزي','both'],
  ['other','other'],['أخرى','other'],
])

const SECTION_TYPES = [
  ['verse', /^(verse|v|مقطع|كوبليه)\s*([\d٠-٩]*)$/i],
  ['chorus', /^(chorus|refrain|قرار|القرار|لازمة)$/i],
  ['pre_chorus', /^(pre[\s-]?chorus|قبل اللازمة)$/i],
  ['bridge', /^(bridge|جسر)$/i],
  ['tag', /^(tag|تاج)$/i],
  ['intro', /^(intro|مقدمة)$/i],
  ['outro', /^(outro|نهاية|ختام)$/i],
  ['instrumental', /^(instrumental|موسيقى|فاصل موسيقي)$/i],
]

const normalizeHeader = value => String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
const cleanText = value => String(value ?? '').replace(/\r\n?/g, '\n').trim()

export function normalizeArabicSearch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
}

export function normalizeSongIdentity(value) {
  return normalizeArabicSearch(value)
    .toLocaleLowerCase('en')
    .replace(/\.[a-z0-9]{2,6}$/i, '')
    .replace(/[’'"`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function detectSongLanguage(...values) {
  const text = values.filter(Boolean).join('\n')
  const arabic = (text.match(ARABIC_CHARACTER) || []).length
  const latin = (text.match(LATIN_CHARACTER) || []).length
  if (!arabic && !latin) return 'other'
  if (arabic > 0 && latin > 0 && Math.min(arabic, latin) / Math.max(arabic, latin) >= 0.15) return 'both'
  return arabic > latin ? 'ar' : 'en'
}

export function textDirection(value) {
  const language = detectSongLanguage(value)
  return language === 'ar' ? 'rtl' : language === 'en' ? 'ltr' : 'auto'
}

export function normalizeLanguage(value, fallbackText = '') {
  const normalized = normalizeHeader(value)
  return LANGUAGE_VALUES.get(normalized) || detectSongLanguage(fallbackText) || 'other'
}

export function parseLyricsSections(content) {
  const raw = String(content ?? '').replace(/\r\n?/g, '\n')
  const sections = []
  let current = null
  const pushCurrent = () => {
    if (!current) return
    while (current.lines.length && current.lines.at(-1) === '') current.lines.pop()
    sections.push({ ...current, content:current.lines.join('\n') })
  }

  raw.split('\n').forEach(line => {
    const match = line.match(/^\s*\[([^\]]+)]\s*$/)
    if (match) {
      pushCurrent()
      const label = match[1].trim()
      const normalized = normalizeArabicSearch(label)
      const type = SECTION_TYPES.find(([, pattern]) => pattern.test(normalized))?.[0] || 'section'
      current = { type, label, lines:[] }
      return
    }
    if (!current) current = { type:'lyrics', label:'', lines:[] }
    current.lines.push(line)
  })
  pushCurrent()
  return { raw, sections }
}

export function parseDelimitedText(text, delimiter = ',') {
  const input = String(text ?? '').replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { cell += '"'; index += 1 }
      else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"') quoted = true
    else if (character === delimiter) { row.push(cell); cell = '' }
    else if (character === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (character !== '\r') cell += character
  }
  row.push(cell)
  if (row.some(value => value !== '') || rows.length === 0) rows.push(row)
  return rows
}

function fieldForHeader(header) {
  const normalized = normalizeHeader(header)
  return Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] || null
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean)
  return cleanText(value).split(/[,;|،]/).map(tag => tag.trim()).filter(Boolean)
}

export function rowsToSongImports(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const headers = rows[0].map(fieldForHeader)
  return rows.slice(1).map((cells, index) => {
    const item = { sourceRow:index + 2 }
    headers.forEach((field, cellIndex) => { if (field) item[field] = cells[cellIndex] ?? '' })
    return normalizeImportedSong(item)
  }).filter(item => Object.values(item).some(value => Array.isArray(value) ? value.length : Boolean(value)))
}

export function normalizeImportedSong(input = {}) {
  const title = cleanText(input.title)
  const arabicTitle = cleanText(input.arabicTitle ?? input.arabic_title)
  const lyrics = String(input.lyrics ?? '').replace(/\r\n?/g, '\n').trim()
  const proChords = String(input.proChords ?? input.pro_chords ?? '').replace(/\r\n?/g, '\n').trim()
  const rawBpm = input.bpm === '' || input.bpm == null ? null : Number(input.bpm)
  const keyInput = cleanText(input.key ?? input.defaultKey ?? input.default_key)
  const key = keyInput ? [...VALID_KEYS].find(valid => valid.toLowerCase() === keyInput.toLowerCase()) || keyInput : 'G'
  return {
    sourceRow:input.sourceRow,
    title,
    arabicTitle,
    artist:cleanText(input.artist ?? input.author),
    key,
    bpm:Number.isFinite(rawBpm) ? rawBpm : null,
    timeSignature:cleanText(input.timeSignature ?? input.time_signature) || '4/4',
    language:normalizeLanguage(input.language, `${title}\n${arabicTitle}\n${lyrics}`),
    ccliNumber:cleanText(input.ccliNumber ?? input.ccli_number),
    lyrics,
    proChords,
    tags:parseTags(input.tags ?? input.themes),
    notes:cleanText(input.notes),
  }
}

export function validateImportedSong(song) {
  const errors = []
  if (!song.title) errors.push('Missing song title')
  if (song.bpm != null && (!Number.isInteger(song.bpm) || song.bpm < 20 || song.bpm > 300)) errors.push('BPM must be a whole number between 20 and 300')
  if (song.key && !VALID_KEYS.has(song.key)) errors.push(`Unsupported key: ${song.key}`)
  if (song.timeSignature && !/^\d{1,2}\/\d{1,2}$/.test(song.timeSignature)) errors.push('Time signature must look like 4/4 or 6/8')
  if (MOJIBAKE.test(`${song.title}\n${song.arabicTitle}\n${song.artist}\n${song.lyrics}`)) errors.push('Text appears to use the wrong character encoding')
  return errors
}

export function findDuplicateSong(song, existingSongs = []) {
  const identities = [song.title, song.arabicTitle].map(normalizeSongIdentity).filter(Boolean)
  const ccli = cleanText(song.ccliNumber)
  let likely = null
  for (const existing of existingSongs) {
    if (ccli && cleanText(existing.ccliNumber ?? existing.ccli_number) === ccli) return { song:existing, confidence:'exact', reason:'CCLI number' }
    const existingIdentities = [existing.title, existing.titleEn, existing.titleAr, existing.title_ar]
      .map(normalizeSongIdentity).filter(Boolean)
    if (identities.some(identity => existingIdentities.includes(identity))) return { song:existing, confidence:'exact', reason:'title' }
    if (!likely && identities.some(identity => existingIdentities.some(candidate => candidate.includes(identity) || identity.includes(candidate)))) {
      likely = { song:existing, confidence:'likely', reason:'similar title' }
    }
  }
  return likely
}

export function buildSongImportPreview(imports, existingSongs = []) {
  return imports.map((song, index) => {
    const errors = validateImportedSong(song)
    const duplicate = errors.length ? null : findDuplicateSong(song, existingSongs)
    return {
      ...song,
      previewId:`row-${song.sourceRow || index + 1}`,
      errors,
      status:errors.length ? 'error' : duplicate ? 'existing' : 'new',
      matchedSongId:duplicate?.song?.id || null,
      matchReason:duplicate?.reason || '',
      matchConfidence:duplicate?.confidence || '',
      action:errors.length ? 'skip' : duplicate ? 'skip' : 'create',
    }
  })
}

export function parsePastedSongs(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split(/^\s*---+\s*$/m).map((block, blockIndex) => {
    const lines = block.trim().split('\n')
    const song = { sourceRow:blockIndex + 1 }
    let multilineField = null
    const multiline = { lyrics:[], proChords:[] }
    lines.forEach(line => {
      const match = line.match(/^\s*([\p{L}_ /]+)\s*:\s*(.*)$/u)
      const field = match ? fieldForHeader(match[1]) : null
      if (field === 'lyrics' || field === 'proChords') {
        multilineField=field
        if(match[2])multiline[field].push(match[2])
      } else if (field) {
        multilineField=null
        song[field]=match[2]
      } else if (multilineField) multiline[multilineField].push(line)
    })
    if(multiline.lyrics.length)song.lyrics=multiline.lyrics.join('\n').trim()
    if(multiline.proChords.length)song.proChords=multiline.proChords.join('\n').trim()
    return normalizeImportedSong(song)
  }).filter(song => song.title || song.lyrics || song.artist)
}

export function parseChordPro(rawContent) {
  const raw = String(rawContent ?? '').replace(/\r\n?/g, '\n')
  const metadata = {}
  const directives = []
  const lines = raw.split('\n').map(line => {
    const directive = line.match(/^\s*\{([^:}]+):\s*([^}]*)}\s*$/)
    if (directive) {
      const name = directive[1].trim().toLowerCase()
      const value = directive[2].trim()
      directives.push({ name, value })
      if (['title','t','artist','subtitle','key','tempo','ccli'].includes(name)) metadata[name === 't' ? 'title' : name] = value
      return { type:'directive', name, value, raw:line }
    }
    const segments = []
    let position = 0
    for (const match of line.matchAll(/\[([^\]]+)]/g)) {
      if (match.index > position) segments.push({ type:'lyric', text:line.slice(position, match.index) })
      segments.push({ type:'chord', text:match[1] })
      position = match.index + match[0].length
    }
    if (position < line.length) segments.push({ type:'lyric', text:line.slice(position) })
    return { type:'line', segments, direction:textDirection(line) }
  })
  return { raw, metadata, directives, lines }
}

export function detectChartKey(fileName, parsedChordPro = null) {
  const metadataKey = parsedChordPro?.metadata?.key
  if (metadataKey && VALID_KEYS.has(metadataKey)) return metadataKey
  const base = String(fileName ?? '').replace(/\.[^.]+$/, '')
  const tokens = base.split(/[\s_-]+/).reverse()
  return tokens.find(token => VALID_KEYS.has(token)) || ''
}

const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT_NOTES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

export function transposeChord(chord, semitones = 0) {
  const value=String(chord ?? '')
  if (!semitones || !value) return value
  return value.replace(/(^|\/)([A-G])([#b]?)/g, (match,prefix,note,accidental) => {
    const source=`${note}${accidental}`
    let index=SHARP_NOTES.indexOf(source)
    if(index<0)index=FLAT_NOTES.indexOf(source)
    if(index<0)return match
    const notes=accidental==='b'?FLAT_NOTES:SHARP_NOTES
    return `${prefix}${notes[(index+Number(semitones)+120)%12]}`
  })
}

function titleCandidates(song) {
  return [song.title, song.titleEn, song.titleAr, song.title_ar].map(normalizeSongIdentity).filter(Boolean)
}

export function matchChordFile({ fileName, rawContent = '' }, songs = []) {
  const extension = String(fileName).split('.').pop()?.toLowerCase() || ''
  const parsedChordPro = ['cho','chopro'].includes(extension) ? parseChordPro(rawContent) : null
  const baseName = String(fileName).replace(/\.[^.]+$/, '')
  const detectedKey = detectChartKey(fileName, parsedChordPro)
  const titleFromFile = detectedKey
    ? baseName.replace(new RegExp(`(?:^|[ _-])${detectedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    : baseName
  const fileIdentity = normalizeSongIdentity(titleFromFile)
  const metadataTitle = normalizeSongIdentity(parsedChordPro?.metadata?.title)
  const ccli = parsedChordPro?.metadata?.ccli || ''
  let best = null

  songs.forEach(song => {
    const candidates = titleCandidates(song)
    let score = 0
    let reason = ''
    if (ccli && String(song.ccliNumber || song.ccli_number) === String(ccli)) { score = 100; reason = 'CCLI number' }
    else if (metadataTitle && candidates.includes(metadataTitle)) { score = 100; reason = 'ChordPro title' }
    else if (candidates.includes(fileIdentity)) { score = 100; reason = 'filename title' }
    else if (candidates.some(candidate => fileIdentity.startsWith(candidate) || fileIdentity.includes(candidate))) { score = 82; reason = 'normalized filename' }
    else {
      const fileTokens = new Set(fileIdentity.split(' ').filter(Boolean))
      const overlap = Math.max(0, ...candidates.map(candidate => {
        const tokens = candidate.split(' ').filter(Boolean)
        return tokens.length ? tokens.filter(token => fileTokens.has(token)).length / tokens.length : 0
      }))
      if (overlap >= 0.75) { score = 65; reason = 'similar filename' }
    }
    if (!best || score > best.score) best = { song, score, reason }
  })

  const confidence = best?.score >= 95 ? 'exact' : best?.score >= 75 ? 'likely' : best?.score >= 55 ? 'review' : 'none'
  return {
    fileName,
    extension,
    detectedKey,
    parsedChordPro,
    matchedSongId:confidence === 'none' ? null : best?.song?.id || null,
    matchedSong:confidence === 'none' ? null : best?.song || null,
    confidence,
    reason:confidence === 'none' ? '' : best.reason,
  }
}

export function slugifySongPath(value) {
  const normalized = normalizeSongIdentity(value)
  const latin = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (latin) return latin.slice(0, 72)
  const encoded = Array.from(normalized).map(character => character.codePointAt(0).toString(16)).join('-')
  return `song-${encoded}`.slice(0, 120)
}

export function csvEscape(value) {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildSongTemplateCsv() {
  const rows = [
    SONG_IMPORT_HEADERS,
    ['Worthy of It All','','David Brymer','G','72','4/4','English','7126736','[Verse 1]\nAll the saints and angels...','[Verse 1]\nG\nAll the saints and angels...','worship, adoration','Original arrangement'],
    ['أنت صالح','أنت صالح','فريق التسبيح','G','76','4/4','Arabic','','[مقطع 1]\nأنت صالح في كل حين\n\n[قرار]\nأنت أمين','[مقطع 1]\nG        C\nأنت صالح في كل حين','تسبيح، صلاح الله','مثال عربي UTF-8'],
  ]
  return `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}`
}
