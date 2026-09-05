import { MUSICAL_KEYS } from './musicKeys.js'
import { parseLyricsSections } from './songImport.js'
import { isBlankText, normalizeRequiredText } from './validation.js'

export function getPrimaryLyrics(song) {
  return song?.primaryLyrics || song?.lyricVersions?.find(item=>item.isPrimary) || song?.lyricVersions?.[0] || null
}

export function getInlineChordChart(song) {
  return song?.charts?.find(chart=>chart.isInline) || null
}

export function getLatestChartVersion(chart) {
  return chart?.versions?.slice().sort((left,right)=>(right.version||0)-(left.version||0))[0] || null
}

export function getSongLyrics(song) {
  return getPrimaryLyrics(song)?.content || ''
}

export function getSongProChords(song) {
  return getLatestChartVersion(getInlineChordChart(song))?.rawContent || ''
}

export function songToForm(song = {}) {
  return {
    ...song,
    title:song.title || '',
    titleEn:song.titleEn && song.titleEn !== song.title ? song.titleEn : '',
    author:song.author || '',
    key:song.key || 'G',
    bpm:song.bpm ?? '',
    timeSignature:song.timeSignature || '4/4',
    language:song.language || 'ar',
    ccliNumber:song.ccliNumber || '',
    tagsText:(song.themes || song.tags || []).join(', '),
    notes:song.notes || '',
    lyrics:getSongLyrics(song),
    proChords:getSongProChords(song),
  }
}

export function prepareSongForm(data = {}) {
  const title=normalizeRequiredText(data.title)
  const titleEn=normalizeRequiredText(data.titleEn)
  const author=normalizeRequiredText(data.author)
  const key=String(data.key || 'G').trim()
  const bpm=data.bpm==='' || data.bpm==null ? null : Number(data.bpm)
  const timeSignature=String(data.timeSignature || '4/4').trim()
  const language=['ar','en','both'].includes(data.language) ? data.language : 'ar'
  const themes=Array.isArray(data.themes)
    ? data.themes.map(item=>normalizeRequiredText(item)).filter(Boolean)
    : String(data.tagsText || '').split(/[,;|،]/).map(item=>normalizeRequiredText(item)).filter(Boolean)
  const lyrics=String(data.lyrics ?? '').replace(/\r\n?/g,'\n')
  const proChords=String(data.proChords ?? '').replace(/\r\n?/g,'\n')
  const errors=[]
  if(isBlankText(title)&&isBlankText(titleEn))errors.push('Song title is required.')
  if(!MUSICAL_KEYS.includes(key))errors.push('Choose a valid musical key.')
  if(bpm!==null&&(!Number.isInteger(bpm)||bpm<20||bpm>300))errors.push('BPM must be a whole number between 20 and 300.')
  if(!/^\d{1,2}\/\d{1,2}$/.test(timeSignature))errors.push('Time signature must look like 4/4 or 6/8.')
  const parsedLyrics=parseLyricsSections(lyrics)
  const detectedSequence=parsedLyrics.sections.map(section=>section.label).filter(Boolean)
  return {
    value:{...data,title,titleEn,author,key,bpm,timeSignature,language,themes,notes:String(data.notes||''),ccliNumber:String(data.ccliNumber||'').trim(),lyrics,proChords,lyricSections:parsedLyrics.sections,sequence:detectedSequence.length?detectedSequence:(data.sequence||[])},
    errors,
  }
}

export function createDemoSongContent(data, id) {
  const now=new Date().toISOString()
  const primaryLyrics=data.lyrics.trim() ? {id:`lyrics-${id}`,songId:id,language:data.language,content:data.lyrics,sections:data.lyricSections,isPrimary:true,is_primary:true,version:1,created_at:now,updated_at:now} : null
  const inlineChart=data.proChords.trim() ? {id:`chart-${id}`,songId:id,arrangementName:'Manual chords',chartKey:data.key,chartType:'txt',isInline:true,is_inline:true,isPrimary:true,is_primary:true,versions:[{id:`version-${id}`,version:1,storagePath:null,rawContent:data.proChords,originalFilename:'manual-chords.txt',mimeType:'text/plain;charset=utf-8',fileSize:new Blob([data.proChords]).size,uploadedAt:now}]} : null
  return {primaryLyrics,lyricVersions:primaryLyrics?[primaryLyrics]:[],charts:inlineChart?[inlineChart]:[]}
}
