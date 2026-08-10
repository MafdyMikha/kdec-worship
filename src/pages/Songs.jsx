import { useState } from 'react'
import { Plus, Music2, Edit2, Trash2, ChevronDown, ChevronUp, Globe } from 'lucide-react'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { canManageWorship } from '../lib/permissions.js'
import { Card, Btn, Badge, SearchInput, Modal, Input, Select, Textarea, Tabs, EmptyState, ConfirmDialog } from '../components/ui'

const KEYS = ['C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab','A','A#','Bb','B','Am','Dm','Em','Gm','Bm']
const SEQ_AR = ['مقدمة','مقطع ١','مقطع ٢','مقطع ٣','لازمة','جسر','قبل اللازمة','ختام']
const SEQ_EN = ['Intro','Verse 1','Verse 2','Verse 3','Chorus','Bridge','Pre-Chorus','Outro']
const PART_COLOR = {
  'مقطع ١':'bg-blue-50 text-blue-700','مقطع ٢':'bg-blue-50 text-blue-700','مقطع ٣':'bg-blue-50 text-blue-700',
  'لازمة':'bg-violet-50 text-violet-700','جسر':'bg-amber-50 text-amber-700','قبل اللازمة':'bg-emerald-50 text-emerald-700',
  'مقدمة':'bg-slate-100 text-slate-600','ختام':'bg-slate-100 text-slate-600',
  'Verse 1':'bg-blue-50 text-blue-700','Verse 2':'bg-blue-50 text-blue-700','Chorus':'bg-violet-50 text-violet-700',
  'Bridge':'bg-amber-50 text-amber-700','Intro':'bg-slate-100 text-slate-600','Outro':'bg-slate-100 text-slate-600',
}

function SongForm({ value, onChange, isAr }) {
  const ALL_SEQ = [...SEQ_AR, ...SEQ_EN]
  const toggleSeq = (item) => {
    const cur = value.sequence||[]
    onChange({...value, sequence: cur.includes(item)?cur.filter(s=>s!==item):[...cur,item]})
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={isAr?'العنوان بالعربي':'Arabic Title'} required dir="rtl" placeholder="يا مالئ كوني"
          value={value.title||''} onChange={e=>onChange({...value,title:e.target.value})}/>
        <Input label={isAr?'العنوان بالإنجليزي':'English Title'} placeholder="Fill My Being"
          value={value.titleEn||''} onChange={e=>onChange({...value,titleEn:e.target.value})}/>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={isAr?'المؤلف':'Author'} placeholder="KDEC Worship" value={value.author||''} onChange={e=>onChange({...value,author:e.target.value})}/>
        <Input label="CCLI" placeholder="4348399" value={value.ccliNumber||''} onChange={e=>onChange({...value,ccliNumber:e.target.value})}/>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Select label={isAr?'الطبقة الأصلية':'Original Key'} value={value.key||'G'} onChange={e=>onChange({...value,key:e.target.value})}>
          {KEYS.map(k=><option key={k} value={k}>{k}</option>)}
        </Select>
        <Input label={isAr?'الإيقاع':'BPM'} type="number" min="40" max="220" placeholder="76"
          value={value.bpm||''} onChange={e=>onChange({...value,bpm:Number(e.target.value)||''})}/>
        <Select label={isAr?'الميزان':'Time Sig'} value={value.timeSignature||'4/4'} onChange={e=>onChange({...value,timeSignature:e.target.value})}>
          {['4/4','3/4','6/8','2/4','12/8'].map(t=><option key={t}>{t}</option>)}
        </Select>
      </div>
      <Select label={isAr?'اللغة':'Language'} value={value.language||'ar'} onChange={e=>onChange({...value,language:e.target.value})}>
        <option value="ar">{isAr?'عربي':'Arabic'}</option>
        <option value="en">{isAr?'إنجليزي':'English'}</option>
        <option value="both">{isAr?'الاثنان':'Both'}</option>
      </Select>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">{isAr?'هيكل الترنيمة':'Song Structure'}</label>
        <div className="flex flex-wrap gap-2">
          {ALL_SEQ.map(s=>(
            <button key={s} type="button" onClick={()=>toggleSeq(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${(value.sequence||[]).includes(s)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <Textarea label={isAr?'ملاحظات':'Notes'} placeholder={isAr?'كابو ٢ على الجيتار...':'Capo 2 on guitar...'}
        value={value.notes||''} onChange={e=>onChange({...value,notes:e.target.value})}/>
    </div>
  )
}

const BLANK = {title:'',titleEn:'',author:'',key:'G',bpm:'',timeSignature:'4/4',language:'ar',sequence:['مقطع ١','لازمة','مقطع ٢','لازمة','جسر'],notes:'',ccliNumber:''}

export default function Songs() {
  const { songs, addSong, updateSong, deleteSong, currentUser } = useStore()
  const { t, isAr } = useLang()
  const [search,   setSearch]   = useState('')
  const [filterKey,setFilterKey]= useState('all')
  const [tab,      setTab]      = useState('all')
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(BLANK)
  const [expanded, setExpanded] = useState(null)
  const [delTarget,setDelTarget]= useState(null)
  const [showEn,   setShowEn]   = useState({})
  const canManage = canManageWorship(currentUser)

  const activeSongs = songs.filter(s => s.status!=='inactive')
  const filtered = activeSongs.filter(s => {
    const q = search.toLowerCase()
    const matchQ = (s.title||'').toLowerCase().includes(q)||(s.titleEn||'').toLowerCase().includes(q)||(s.author||'').toLowerCase().includes(q)
    const matchKey = filterKey==='all'||s.key===filterKey
    const matchTab = tab==='all'||(tab==='ar'?s.language==='ar':s.language==='en')
    return matchQ&&matchKey&&matchTab
  }).sort((a,b)=>a.title.localeCompare(b.title,'ar'))

  const openAdd  = () => { setEditing(null); setForm(BLANK); setShowAdd(true) }
  const openEdit = (s) => { setEditing(s.id); setForm({...s,titleEn:s.titleEn||''}); setShowAdd(true) }
  const handleSave = async () => {
    if (!form.title) return
    const result = editing ? await updateSong(editing, form) : await addSong(form)
    if (!result?.error) { setShowAdd(false); setEditing(null); setForm(BLANK) }
  }

  const LANG_COLOR = {ar:'orange',en:'blue',both:'purple'}
  const LANG_LABEL = isAr
    ? {ar:'عربي',en:'إنجليزي',both:'الاثنان'}
    : {ar:'Arabic',en:'English',both:'Both'}

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch}
            placeholder={isAr?'ابحث بالعربي أو الإنجليزي...':'Search in Arabic or English...'} className="w-full sm:w-64"/>
          <select value={filterKey} onChange={e=>setFilterKey(e.target.value)}
            aria-label={isAr?'تصفية حسب الطبقة':'Filter by key'}
            className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">{isAr?'كل الطبقات':'All Keys'}</option>
            {KEYS.map(k=><option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {canManage&&<Btn onClick={openAdd} icon={<Plus size={16}/>}>{isAr?'إضافة ترنيمة':'Add Song'}</Btn>}
      </div>

      <Tabs tabs={[
        { label:t('all'),     value:'all', count:activeSongs.length },
        { label:t('arabic'),  value:'ar',  count:activeSongs.filter(s=>s.language==='ar').length },
        { label:t('english'), value:'en',  count:activeSongs.filter(s=>s.language==='en').length },
      ]} active={tab} onChange={setTab}/>

      {filtered.length===0 ? (
        <EmptyState icon={<Music2 size={28}/>}
          title={isAr?'لا توجد ترانيم':'No songs found'}
          description={isAr?'أضف ترانيم لبناء مكتبة التسبيح.':'Add songs to build your library.'}
          action={canManage?<Btn onClick={openAdd} icon={<Plus size={16}/>}>{isAr?'إضافة ترنيمة':'Add Song'}</Btn>:null}/>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-12 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span className="col-span-5">{isAr?'الترنيمة':'Song'}</span>
            <span className="col-span-2">{isAr?'الطبقة':'Key'}</span>
            <span className="col-span-2">BPM</span>
            <span className="col-span-2">{isAr?'الاستخدام':'Usage'}</span>
            <span className="col-span-1"/>
          </div>
          {filtered.map(song=>(
            <Card key={song.id} className={expanded===song.id?'ring-2 ring-indigo-200':''}>
              <div className="grid grid-cols-12 px-4 py-3.5 items-center gap-2">
                <div className="col-span-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800" dir="rtl">{song.title}</span>
                    {song.titleEn && (
                      <button onClick={()=>setShowEn(prev=>({...prev,[song.id]:!prev[song.id]}))} aria-pressed={!!showEn[song.id]}
                        aria-label={isAr?'إظهار العنوان الإنجليزي':'Show English title'}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${showEn[song.id]?'bg-indigo-600 text-white border-indigo-600':'bg-white text-indigo-400 border-indigo-200 hover:border-indigo-400'}`}>
                        <Globe size={9}/> EN
                      </button>
                    )}
                  </div>
                  {showEn[song.id]&&song.titleEn&&<div className="text-xs text-slate-400 italic mt-0.5">{song.titleEn}</div>}
                  <div className="text-xs text-slate-400">{song.author}</div>
                </div>
                <div className="col-span-2"><Badge color="slate">{song.key}</Badge></div>
                <div className="col-span-2 text-sm text-slate-600">{song.bpm||'—'}</div>
                <div className="col-span-2 text-sm text-slate-600">{song.usageCount||0}×</div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  {canManage&&<button onClick={()=>openEdit(song)} aria-label={isAr?'تعديل الترنيمة':'Edit song'} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer"><Edit2 size={13}/></button>}
                  <button onClick={()=>setExpanded(expanded===song.id?null:song.id)} aria-expanded={expanded===song.id} aria-label={isAr?'عرض تفاصيل الترنيمة':'Show song details'} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded cursor-pointer">
                    {expanded===song.id?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                  </button>
                </div>
              </div>
              {expanded===song.id && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 animate-slide-up">
                  <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>{isAr?'الميزان':'Time sig'}: <strong>{song.timeSignature||'4/4'}</strong></span>
                    {song.ccliNumber&&<span>CCLI: <strong>{song.ccliNumber}</strong></span>}
                    {song.lastUsed&&<span>{isAr?'آخر استخدام':'Last used'}: <strong>{song.lastUsed}</strong></span>}
                    <Badge color={LANG_COLOR[song.language]||'slate'} size="xs">{LANG_LABEL[song.language]||song.language}</Badge>
                  </div>
                  {song.sequence?.length>0&&(
                    <div className="flex flex-wrap gap-1.5">
                      {song.sequence.map((p,i)=><span key={i} className={`px-2.5 py-1 rounded text-xs font-medium ${PART_COLOR[p]||'bg-slate-100 text-slate-600'}`}>{p}</span>)}
                    </div>
                  )}
                  {song.notes&&<p className="text-sm text-slate-500 italic">📝 {song.notes}</p>}
                  {canManage&&<div className="flex gap-2 pt-1">
                    <Btn variant="outline" size="xs" onClick={()=>openEdit(song)} icon={<Edit2 size={11}/>}>{t('edit')}</Btn>
                    <Btn variant="ghost" size="xs" onClick={()=>setDelTarget(song.id)} className="text-red-500 hover:bg-red-50" icon={<Trash2 size={11}/>}>{isAr?'أرشفة':'Archive'}</Btn>
                  </div>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={canManage&&showAdd} onClose={()=>{setShowAdd(false);setEditing(null)}}
        title={editing?(isAr?'تعديل الترنيمة':'Edit Song'):(isAr?'إضافة ترنيمة جديدة':'Add New Song')} size="lg"
        footer={<><Btn variant="secondary" onClick={()=>setShowAdd(false)}>{t('cancel')}</Btn><Btn onClick={handleSave} disabled={!form.title}>{editing?t('saveChanges'):(isAr?'إضافة':'Add Song')}</Btn></>}>
        <SongForm value={form} onChange={setForm} isAr={isAr}/>
      </Modal>

      <ConfirmDialog open={canManage&&!!delTarget} onClose={()=>setDelTarget(null)}
        onConfirm={async()=>{const result=await deleteSong(delTarget);if(!result?.error)setDelTarget(null);return result}}
        title={isAr?'أرشفة الترنيمة':'Archive Song'}
        confirmLabel={isAr?'أرشفة':'Archive'}
        message={isAr?'سيتم إخفاء الترنيمة مع الحفاظ على سجل استخدامها.':'The song will be hidden while its usage history is preserved.'}/>
    </div>
  )
}
