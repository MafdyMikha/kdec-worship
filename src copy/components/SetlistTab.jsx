import { useState } from 'react'
import { GripVertical, Trash2, Music2, Edit2, Check, X, Plus, MessageSquare, Globe } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Card, Badge, Btn, Modal, Select, Input } from '../components/ui'

const KEYS = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Am','Dm','Em','Gm','Bm']

const PART_COLOR = {
  'مقدمة':'bg-slate-100 text-slate-600','مقطع ١':'bg-blue-50 text-blue-700',
  'مقطع ٢':'bg-blue-50 text-blue-700','مقطع ٣':'bg-blue-50 text-blue-700',
  'مقطع ٤':'bg-blue-50 text-blue-700','لازمة':'bg-violet-50 text-violet-700',
  'جسر':'bg-amber-50 text-amber-700','قبل اللازمة':'bg-emerald-50 text-emerald-700',
  'ختام':'bg-slate-100 text-slate-600',
  'Verse 1':'bg-blue-50 text-blue-700','Verse 2':'bg-blue-50 text-blue-700',
  'Verse 3':'bg-blue-50 text-blue-700','Chorus':'bg-violet-50 text-violet-700',
  'Bridge':'bg-amber-50 text-amber-700','Pre-Chorus':'bg-emerald-50 text-emerald-700',
  'Tag':'bg-pink-50 text-pink-700','Intro':'bg-slate-100 text-slate-600',
  'Outro':'bg-slate-100 text-slate-600',
}

function KeyEditor({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value || 'G')
  if (!editing) return (
    <button onClick={() => setEditing(true)}
      className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded text-xs font-medium cursor-pointer transition-all">
      {value || '—'} <Edit2 size={9}/>
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <select value={local} onChange={e => setLocal(e.target.value)} autoFocus
        className="px-2 py-0.5 border border-indigo-300 rounded text-xs focus:outline-none bg-white">
        {KEYS.map(k => <option key={k}>{k}</option>)}
      </select>
      <button onClick={() => { onChange(local); setEditing(false) }} className="p-1 text-emerald-500 cursor-pointer"><Check size={13}/></button>
      <button onClick={() => setEditing(false)} className="p-1 text-slate-400 cursor-pointer"><X size={13}/></button>
    </div>
  )
}

function NotesBlock({ block, onUpdate, onDelete, canEdit, isAr }) {
  const [editing, setEditing] = useState(!block.text)
  const [text, setText] = useState(block.text || '')
  const styles = {
    note:'bg-amber-50 border-amber-200 text-amber-800',
    prayer:'bg-violet-50 border-violet-200 text-violet-800',
    reading:'bg-blue-50 border-blue-200 text-blue-800',
    break:'bg-slate-50 border-slate-200 text-slate-600',
  }
  const icons = { note:'📝', prayer:'🙏', reading:'📖', break:'⏸' }
  return (
    <div className={`flex gap-3 items-start px-4 py-3 border rounded-xl ${styles[block.type]||styles.note} group`}>
      <span className="text-sm flex-shrink-0 mt-0.5">{icons[block.type]||'📝'}</span>
      <div className="flex-1 min-w-0">
        {editing && canEdit ? (
          <div className="space-y-2">
            <textarea value={text} onChange={e=>setText(e.target.value)} dir="auto"
              placeholder={isAr?'اكتب هنا...':'Write here...'} rows={2}
              className="w-full text-sm bg-transparent border-0 outline-none resize-none placeholder:text-current placeholder:opacity-50"/>
            <div className="flex gap-2">
              <button onClick={()=>{onUpdate({...block,text});setEditing(false)}}
                className="px-2.5 py-1 bg-white/70 text-xs font-medium rounded-lg cursor-pointer hover:bg-white/90">
                {isAr?'حفظ':'Save'}
              </button>
              <button onClick={()=>{if(!block.text)onDelete();else setEditing(false)}}
                className="px-2.5 py-1 text-xs cursor-pointer opacity-60 hover:opacity-100">
                {isAr?'إلغاء':'Cancel'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-relaxed" dir="auto">{block.text || <span className="opacity-40 italic">{isAr?'فارغ':'Empty'}</span>}</p>
            {canEdit && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={()=>setEditing(true)} className="p-1 hover:bg-white/60 rounded cursor-pointer"><Edit2 size={11}/></button>
                <button onClick={onDelete} className="p-1 hover:bg-white/60 rounded cursor-pointer"><Trash2 size={11}/></button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SongRow({ item, idx, canEdit, onRemove, onUpdateKey, dragOver, onDragStart, onDragOver, onDrop, isAr }) {
  const [showEn, setShowEn] = useState(false)
  const song = item.song
  const hasEn = !!(song?.titleEn && song.titleEn.trim())

  return (
    <div
      draggable={canEdit}
      onDragStart={e=>onDragStart(e,idx)}
      onDragOver={e=>onDragOver(e,idx)}
      onDrop={e=>onDrop(e,idx)}
      className={`flex items-start gap-3 bg-white rounded-xl border p-4 shadow-sm group transition-all select-none ${dragOver===idx?'border-indigo-400 bg-indigo-50 scale-[1.01] shadow-md':'border-slate-200 hover:shadow-md'}`}>

      <div className="flex items-center gap-1 flex-shrink-0 mt-1">
        <span className="text-slate-300 w-5 text-center text-sm font-mono">{idx+1}</span>
        {canEdit && <button className="text-slate-200 hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5"><GripVertical size={15}/></button>}
      </div>

      <div className="flex-1 min-w-0">
        {song ? (
          <>
            <div className="flex items-start gap-2 flex-wrap mb-1.5">
              <span className="font-bold text-slate-800 text-base leading-snug" dir="rtl">{song.title}</span>
              {hasEn && (
                <button onClick={()=>setShowEn(v=>!v)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-all mt-0.5 ${showEn?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-400 border-indigo-200 hover:border-indigo-400 hover:text-indigo-600'}`}>
                  <Globe size={9}/> EN
                </button>
              )}
            </div>
            {showEn && hasEn && <div className="text-sm text-slate-500 italic mb-1.5 pl-1">{song.titleEn}</div>}

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {canEdit
                ? <KeyEditor value={item.key||song.key} onChange={k=>onUpdateKey(item,k)}/>
                : <Badge color="slate" size="xs">{item.key||song.key}</Badge>}
              {song.bpm && <span className="text-xs text-slate-400">{song.bpm} BPM</span>}
              {song.timeSignature && song.timeSignature!=='4/4' && <span className="text-xs text-slate-400">{song.timeSignature}</span>}
              {song.author && <span className="text-xs text-slate-300">· {song.author}</span>}
            </div>

            {song.sequence?.length>0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {song.sequence.map((part,i)=>(
                  <span key={i} className={`px-2 py-0.5 rounded text-xs font-medium ${PART_COLOR[part]||'bg-slate-100 text-slate-600'}`}>{part}</span>
                ))}
              </div>
            )}
            {item.notes && <p className="text-xs text-slate-500 italic">📌 {item.notes}</p>}
          </>
        ) : (
          <span className="text-slate-400 text-sm">{isAr?'ترنيمة غير موجودة':'Song not found'}</span>
        )}
      </div>

      {canEdit && (
        <button onClick={()=>onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all flex-shrink-0 mt-0.5">
          <Trash2 size={14}/>
        </button>
      )}
    </div>
  )
}

export default function SetlistTab({ service, canEdit=true }) {
  const { songs, addToSetlist, removeFromSetlist, reorderSetlist } = useStore()
  const { isAr, t } = useLang()

  const [showAddSong,   setShowAddSong]   = useState(false)
  const [songSearch,    setSongSearch]    = useState('')
  const [selectedSong,  setSelectedSong]  = useState(null)
  const [songKey,       setSongKey]       = useState('')
  const [songNotes,     setSongNotes]     = useState('')
  const [dragIdx,       setDragIdx]       = useState(null)
  const [dragOver,      setDragOver]      = useState(null)
  const [showBlockMenu, setShowBlockMenu] = useState(null)
  const [blocks,        setBlocks]        = useState({})

  const sortedSetlist = [...service.setlist]
    .sort((a,b)=>a.order-b.order)
    .map(item=>({...item, song:songs.find(s=>s.id===item.songId)||item.song}))

  const filteredSongs = songs.filter(s => {
    if (!songSearch) return !service.setlist.find(i=>i.songId===s.id)
    const q = songSearch.toLowerCase()
    return (s.title.includes(songSearch)||(s.titleEn||'').toLowerCase().includes(q)||(s.author||'').toLowerCase().includes(q))
      && !service.setlist.find(i=>i.songId===s.id)
  })

  const handleDragStart = (e,idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed='move' }
  const handleDragOver  = (e,idx) => { e.preventDefault(); setDragOver(idx) }
  const handleDrop      = (e,idx) => {
    e.preventDefault()
    if (dragIdx===null||dragIdx===idx){setDragIdx(null);setDragOver(null);return}
    const list=[...sortedSetlist]; const [item]=list.splice(dragIdx,1); list.splice(idx,0,item)
    reorderSetlist(service.id, list.map((i,n)=>({...i,order:n+1})))
    setDragIdx(null); setDragOver(null)
  }
  const handleUpdateKey=(item,newKey)=>{ reorderSetlist(service.id,sortedSetlist.map(i=>i.id===item.id?{...i,key:newKey}:i)) }
  const handleAddSong=()=>{ if(!selectedSong)return; addToSetlist(service.id,selectedSong.id,songKey||selectedSong.key,songNotes); setShowAddSong(false);setSelectedSong(null);setSongKey('');setSongNotes('');setSongSearch('') }

  const addBlock=(afterIdx,type)=>{ const key=`after_${afterIdx}`; setBlocks(b=>({...b,[key]:[...(b[key]||[]),{id:Date.now(),type,text:''}]})); setShowBlockMenu(null) }
  const updateBlock=(afterIdx,blockId,data)=>{ const key=`after_${afterIdx}`; setBlocks(b=>({...b,[key]:(b[key]||[]).map(bl=>bl.id===blockId?data:bl)})) }
  const deleteBlock=(afterIdx,blockId)=>{ const key=`after_${afterIdx}`; setBlocks(b=>({...b,[key]:(b[key]||[]).filter(bl=>bl.id!==blockId)})) }

  const BLOCK_TYPES = isAr
    ? [['note','📝 ملاحظة'],['prayer','🙏 صلاة'],['reading','📖 قراءة'],['break','⏸ استراحة']]
    : [['note','📝 Note'],['prayer','🙏 Prayer'],['reading','📖 Reading'],['break','⏸ Break']]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {sortedSetlist.length} {isAr?'ترنيمة':'songs'} · ~{sortedSetlist.length*5} {isAr?'دقيقة':'min'}
        </p>
        {canEdit && (
          <Btn size="sm" onClick={()=>setShowAddSong(true)} icon={<Plus size={14}/>}>{t('addSong')}</Btn>
        )}
      </div>

      {sortedSetlist.length===0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 mb-3"><Music2 size={28}/></div>
          <p className="text-slate-500 text-sm mb-3">{t('noSongsYet')}</p>
          {canEdit && <Btn size="sm" onClick={()=>setShowAddSong(true)} icon={<Plus size={14}/>}>{isAr?'أضف أول ترنيمة':'Add first song'}</Btn>}
        </div>
      )}

      {sortedSetlist.map((item,idx)=>(
        <div key={item.id}>
          <SongRow
            item={item} idx={idx} canEdit={canEdit} dragOver={dragOver} isAr={isAr}
            onRemove={(id)=>removeFromSetlist(service.id,id)}
            onUpdateKey={handleUpdateKey}
            onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}/>

          {(blocks[`after_${idx}`]||[]).map(bl=>(
            <div key={bl.id} className="ml-8 mt-2">
              <NotesBlock block={bl} canEdit={canEdit} isAr={isAr}
                onUpdate={(data)=>updateBlock(idx,bl.id,data)}
                onDelete={()=>deleteBlock(idx,bl.id)}/>
            </div>
          ))}

          {canEdit && (
            <div className="ml-8 mt-1">
              {showBlockMenu===idx ? (
                <div className="flex gap-1.5 flex-wrap py-1 animate-slide-up">
                  {BLOCK_TYPES.map(([type,label])=>(
                    <button key={type} onClick={()=>addBlock(idx,type)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 cursor-pointer text-slate-600 transition-all">
                      {label}
                    </button>
                  ))}
                  <button onClick={()=>setShowBlockMenu(null)} className="px-2 py-1.5 text-xs text-slate-400 cursor-pointer hover:text-slate-600">✕</button>
                </div>
              ) : (
                <button onClick={()=>setShowBlockMenu(idx)}
                  className="flex items-center gap-1 text-xs text-slate-300 hover:text-slate-500 cursor-pointer transition-all py-0.5">
                  <Plus size={10}/> <MessageSquare size={10}/> {t('addBlock')}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <Modal open={showAddSong}
        onClose={()=>{setShowAddSong(false);setSelectedSong(null);setSongSearch('')}}
        title={t('addSong')} size="lg"
        footer={<>
          <Btn variant="secondary" onClick={()=>setShowAddSong(false)}>{t('cancel')}</Btn>
          <Btn onClick={handleAddSong} disabled={!selectedSong}>{isAr?'إضافة للقائمة':'Add to Setlist'}</Btn>
        </>}>
        <div className="space-y-4">
          <input value={songSearch} onChange={e=>{setSongSearch(e.target.value);setSelectedSong(null)}}
            placeholder={isAr?'ابحث بالعربي أو الإنجليزي أو اسم المؤلف...':'Search by title, English title or author...'} dir="auto"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300"/>

          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
            {filteredSongs.length===0 && <p className="text-slate-400 text-sm text-center py-6">{isAr?'لا توجد نتائج':'No results'}</p>}
            {filteredSongs.map(s=>(
              <div key={s.id} onClick={()=>{setSelectedSong(s);setSongKey(s.key)}}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${selectedSong?.id===s.id?'border-indigo-300 bg-indigo-50':'border-transparent hover:bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm" dir="rtl">{s.title}</div>
                  {s.titleEn && <div className="text-xs text-slate-400 italic">{s.titleEn}</div>}
                  <div className="text-xs text-slate-400 mt-0.5">{s.author} · {s.key} · {s.bpm} BPM</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge color="slate" size="xs">{s.key}</Badge>
                  {selectedSong?.id===s.id && <Check size={15} className="text-indigo-600"/>}
                </div>
              </div>
            ))}
          </div>

          {selectedSong && (
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <Select label={isAr?'طبقة هذه الخدمة':'Key for this service'} value={songKey} onChange={e=>setSongKey(e.target.value)}>
                {KEYS.map(k=><option key={k} value={k}>{k}</option>)}
              </Select>
              <Input label={isAr?'ملاحظة للقائد':'Leader note'} placeholder={isAr?'مثال: جسر مرتين':'e.g. Bridge twice'} value={songNotes} onChange={e=>setSongNotes(e.target.value)}/>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
