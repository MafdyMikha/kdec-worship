import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileMusic, FileSpreadsheet, History, Upload } from 'lucide-react'
import { readSheet } from 'read-excel-file/browser'
import { Badge, Btn, Input, Modal, Select, Tabs, Textarea } from '../ui'
import {
  buildSongImportPreview,
  buildSongTemplateCsv,
  csvEscape,
  matchChordFile,
  normalizeImportedSong,
  parseDelimitedText,
  parsePastedSongs,
  rowsToSongImports,
  validateImportedSong,
} from '../../lib/songImport.js'

const CHART_EXTENSIONS = new Set(['pdf','cho','chopro','txt','docx','png','jpg','jpeg','webp'])
const chartTypeFor = extension => extension === 'pdf' ? 'pdf'
  : ['cho','chopro'].includes(extension) ? 'chordpro'
    : extension === 'txt' ? 'txt'
      : extension === 'docx' ? 'docx'
        : ['png','jpg','jpeg','webp'].includes(extension) ? 'image' : 'other'

function downloadText(name, content, type='text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function SummaryCards({ rows, isAr }) {
  const counts = rows.reduce((result,row) => ({
    ...result,
    [row.errors?.length ? 'errors' : row.status]:(result[row.errors?.length ? 'errors' : row.status] || 0) + 1,
  }), {})
  return <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {[
      ['new',isAr?'جديدة':'New','indigo'],
      ['existing',isAr?'موجودة':'Existing','yellow'],
      ['errors',isAr?'أخطاء':'Errors','red'],
      ['total',isAr?'الإجمالي':'Total','slate'],
    ].map(([key,label,color]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xl font-bold text-slate-800">{key==='total'?rows.length:(counts[key]||0)}</div>
      <Badge color={color}>{label}</Badge>
    </div>)}
  </div>
}

function ImportSongsPane({ songs, isAr, onImport }) {
  const [mode,setMode]=useState('file')
  const [rows,setRows]=useState([])
  const [source,setSource]=useState('')
  const [paste,setPaste]=useState('')
  const [error,setError]=useState('')
  const [pending,setPending]=useState(false)
  const [result,setResult]=useState(null)

  const loadImports = (imports,name) => {
    setRows(buildSongImportPreview(imports,songs))
    setSource(name)
    setResult(null)
    setError('')
  }
  const chooseFile = async event => {
    const file=event.target.files?.[0]
    if(!file)return
    try{
      const extension=file.name.split('.').pop()?.toLowerCase()
      if(!['csv','xlsx'].includes(extension))throw new Error(isAr?'اختر ملف CSV أو XLSX.':'Choose a CSV or XLSX file.')
      const table=extension==='xlsx' ? await readSheet(file) : parseDelimitedText(new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()))
      loadImports(rowsToSongImports(table),file.name)
    }catch(caught){setError(caught instanceof Error?caught.message:'The file could not be read.');setRows([])}
  }
  const parsePaste = () => {
    const parsed=parsePastedSongs(paste)
    if(!parsed.length){setError(isAr?'لم يتم العثور على ترانيم. استخدم الحقول مثل Title و Lyrics.':'No songs found. Use fields such as Title and Lyrics.');return}
    loadImports(parsed,isAr?'نص ملصق':'Pasted songs')
  }
  const changeRow=(index,field,value)=>setRows(previous=>previous.map((row,rowIndex)=>{
    if(rowIndex!==index)return row
    const normalized=normalizeImportedSong({...row,[field]:value})
    const suggestion=buildSongImportPreview([normalized],songs)[0]
    return {...row,...normalized,errors:validateImportedSong(normalized),status:suggestion.status,matchedSongId:suggestion.matchedSongId,matchReason:suggestion.matchReason,matchConfidence:suggestion.matchConfidence,action:row.errors?.length ? suggestion.action : row.action}
  }))
  const changeAction=(index,action)=>setRows(previous=>previous.map((row,rowIndex)=>rowIndex===index?{...row,action}:row))
  const importNow=async()=>{
    setPending(true);setError('');setResult(null)
    const extension=source.split('.').pop()?.toLowerCase()
    const importType=mode==='paste'?'songs_paste':extension==='xlsx'?'songs_xlsx':'songs_csv'
    const response=await onImport(rows,{sourceName:source,importType})
    setPending(false)
    if(response?.error)setError(response.error);else setResult(response)
  }
  const failures=rows.filter(row=>row.errors?.length)
  const downloadFailures=()=>downloadText('kdec-song-import-failures.csv',`\uFEFFsource_row,title,errors\r\n${failures.map(row=>[row.sourceRow,row.title,row.errors.join('; ')].map(csvEscape).join(',')).join('\r\n')}`)

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tabs tabs={[{value:'file',label:isAr?'ملف CSV / Excel':'CSV / Excel file'},{value:'paste',label:isAr?'لصق ترانيم':'Paste songs'}]} active={mode} onChange={setMode}/>
      <Btn variant="outline" size="sm" icon={<Download size={15}/>} onClick={()=>downloadText('kdec-song-import-template.csv',buildSongTemplateCsv())}>{isAr?'تحميل النموذج':'Download template'}</Btn>
    </div>
    {mode==='file'?<label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-5 text-center hover:border-indigo-400">
      <FileSpreadsheet className="mb-2 text-indigo-500"/>
      <span className="font-semibold text-slate-700">{isAr?'اختر ملف XLSX أو CSV UTF-8':'Choose an XLSX or UTF-8 CSV file'}</span>
      <span className="mt-1 text-xs text-slate-500">{isAr?'العنوان هو الحقل الوحيد المطلوب':'Title is the only required field'}</span>
      <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={chooseFile}/>
    </label>:<div className="space-y-2">
      <Textarea rows={9} dir="auto" value={paste} onChange={event=>setPaste(event.target.value)} placeholder={'Title: Worthy of It All\nArtist: David Brymer\nLyrics:\n[Verse 1]\nAll the saints...\n\n---\n\nTitle: أنت صالح\nArabic Title: أنت صالح\nLyrics:\n[مقطع 1]\nأنت صالح...'}/>
      <Btn onClick={parsePaste}>{isAr?'تحليل النص':'Preview pasted songs'}</Btn>
    </div>}
    {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    {result&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="me-2 inline" size={18}/>{isAr?'اكتمل الاستيراد:':'Import complete:'} {result.created||0} {isAr?'جديدة،':'created,'} {result.updated||0} {isAr?'محدثة،':'updated,'} {result.skipped||0} {isAr?'متخطاة،':'skipped,'} {result.errors||0} {isAr?'أخطاء':'errors'}</div>}
    {rows.length>0&&<>
      <SummaryCards rows={rows} isAr={isAr}/>
      <div className="max-h-[44vh] space-y-3 overflow-y-auto pe-1">
        {rows.map((row,index)=><div key={row.previewId||index} className={`rounded-xl border p-3 ${row.errors?.length?'border-red-200 bg-red-50/40':row.status==='existing'?'border-amber-200 bg-amber-50/30':'border-slate-200'}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><strong className="text-sm text-slate-800">#{row.sourceRow||index+1}</strong><Badge color={row.errors?.length?'red':row.status==='existing'?'yellow':'green'}>{row.errors?.length?(isAr?'يحتاج تصحيح':'Needs fixing'):row.status==='existing'?(isAr?'تطابق موجود':'Duplicate found'):(isAr?'جاهزة':'Ready')}</Badge></div>
            <Select aria-label={isAr?'إجراء الاستيراد':'Import action'} value={row.action} onChange={event=>changeAction(index,event.target.value)} className="w-44" disabled={row.errors?.length}>
              <option value="create">{isAr?'إنشاء':'Create'}</option><option value="update">{isAr?'تحديث المطابقة':'Update match'}</option><option value="create_new">{isAr?'إنشاء كنسخة جديدة':'Create as new'}</option><option value="skip">{isAr?'تخطي':'Skip'}</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input value={row.title} onChange={event=>changeRow(index,'title',event.target.value)} placeholder={isAr?'العنوان':'Title'} dir="auto"/>
            <Input value={row.arabicTitle} onChange={event=>changeRow(index,'arabicTitle',event.target.value)} placeholder={isAr?'العنوان العربي':'Arabic title'} dir="rtl"/>
            <Input value={row.artist} onChange={event=>changeRow(index,'artist',event.target.value)} placeholder={isAr?'الفنان / الفريق':'Artist / band'}/>
            <Input value={row.key} onChange={event=>changeRow(index,'key',event.target.value)} placeholder={isAr?'الطبقة':'Key'}/>
          </div>
          {row.matchedSongId&&<p className="mt-2 text-xs text-amber-700">{isAr?'التطابق:':'Match:'} {songs.find(song=>song.id===row.matchedSongId)?.title} — {row.matchReason}</p>}
          {row.errors?.length>0&&<ul className="mt-2 list-disc ps-5 text-xs text-red-700">{row.errors.map(item=><li key={item}>{item}</li>)}</ul>}
        </div>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
        {failures.length?<Btn variant="secondary" size="sm" icon={<Download size={15}/>} onClick={downloadFailures}>{isAr?'تنزيل الأخطاء':'Download failures'}</Btn>:<span/>}
        <Btn onClick={importNow} disabled={pending||!rows.length} icon={<Upload size={16}/>}>{pending?'…':(isAr?'بدء الاستيراد':'Import songs')}</Btn>
      </div>
    </>}
  </div>
}

function ChartUploadPane({ songs,isAr,onUpload }) {
  const [items,setItems]=useState([])
  const [error,setError]=useState('')
  const [pending,setPending]=useState(false)
  const [result,setResult]=useState(null)
  const chooseFiles=async event=>{
    const files=[...(event.target.files||[])]
    const next=[]
    for(const file of files){
      const extension=file.name.split('.').pop()?.toLowerCase()||''
      if(!CHART_EXTENSIONS.has(extension)||file.size>20*1024*1024){next.push({file,error:file.size>20*1024*1024?'File exceeds 20 MB':'Unsupported file type'});continue}
      const rawContent=['cho','chopro','txt'].includes(extension)?await file.text():''
      const match=matchChordFile({fileName:file.name,rawContent},songs)
      next.push({...match,file,rawContent,chartType:chartTypeFor(extension),arrangementName:'Original',notes:'',isPrimary:false})
    }
    setItems(next);setError('');setResult(null)
  }
  const update=(index,changes)=>setItems(previous=>previous.map((item,itemIndex)=>itemIndex===index?{...item,...changes}:item))
  const upload=async()=>{setPending(true);setError('');const response=await onUpload(items,{sourceName:`${items.length} chart files`});setPending(false);if(response?.error)setError(response.error);else setResult(response)}
  return <div className="space-y-4">
    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-5 text-center hover:border-violet-400">
      <FileMusic className="mb-2 text-violet-500"/><span className="font-semibold text-slate-700">{isAr?'اختر ملفات Pro Chords':'Choose Pro Chord files'}</span><span className="mt-1 text-xs text-slate-500">PDF, ChordPro, TXT, DOCX, PNG/JPG · 20 MB max each</span>
      <input type="file" multiple accept=".pdf,.cho,.chopro,.txt,.docx,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={chooseFiles}/>
    </label>
    {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    {result&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{result.uploaded||0} {isAr?'ملفات تم رفعها،':'files uploaded,'} {result.errors||0} {isAr?'أخطاء':'errors'}</p>}
    <div className="max-h-[52vh] space-y-3 overflow-y-auto pe-1">{items.map((item,index)=><div key={`${item.file.name}-${index}`} className={`rounded-xl border p-3 ${item.error?'border-red-200 bg-red-50':'border-slate-200'}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><strong className="block text-sm text-slate-800">{item.file.name}</strong><span className="text-xs text-slate-500">{(item.file.size/1024).toFixed(1)} KB · {item.chartType||'unsupported'}</span></div>{!item.error&&<Badge color={item.confidence==='exact'?'green':item.confidence==='likely'?'blue':item.confidence==='review'?'yellow':'red'}>{item.confidence==='none'?(isAr?'بدون تطابق':'No match'):item.confidence}</Badge>}</div>
      {item.error?<p className="text-sm text-red-700">{item.error}</p>:<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={item.matchedSongId||''} onChange={event=>update(index,{matchedSongId:event.target.value})} aria-label={isAr?'اختر الترنيمة':'Select song'}><option value="">{isAr?'— اختر الترنيمة —':'— Select song —'}</option>{songs.filter(song=>song.status!=='inactive').map(song=><option key={song.id} value={song.id}>{song.title}{song.titleEn?` / ${song.titleEn}`:''}</option>)}</Select>
        <Input value={item.arrangementName} onChange={event=>update(index,{arrangementName:event.target.value})} placeholder={isAr?'التوزيع':'Arrangement'}/>
        <Input value={item.detectedKey} onChange={event=>update(index,{detectedKey:event.target.value})} placeholder={isAr?'الطبقة':'Key'}/>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={item.isPrimary} onChange={event=>update(index,{isPrimary:event.target.checked})}/>{isAr?'النسخة الأساسية':'Primary chart'}</label>
      </div>}
    </div>)}</div>
    {items.length>0&&<div className="flex justify-end border-t border-slate-100 pt-4"><Btn icon={<Upload size={16}/>} disabled={pending||items.every(item=>item.error)} onClick={upload}>{pending?'…':(isAr?'رفع الملفات':'Upload charts')}</Btn></div>}
  </div>
}

function HistoryPane({ history,isAr }) {
  const batches=useMemo(()=>[...history].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),[history])
  const downloadErrors=batch=>{
    const errors=(batch.items||[]).filter(item=>item.status==='error')
    downloadText(`kdec-import-${batch.id}-failures.csv`,`\uFEFFsource,status,error\r\n${errors.map(item=>[item.source_name,item.status,item.error_message].map(csvEscape).join(',')).join('\r\n')}`)
  }
  if(!batches.length)return <div className="py-14 text-center text-slate-500"><History className="mx-auto mb-3 text-slate-300" size={34}/>{isAr?'لا يوجد سجل استيراد بعد':'No import history yet'}</div>
  return <div className="space-y-3">{batches.map(batch=><div key={batch.id} className="rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-sm text-slate-800">{batch.source_name||batch.import_type}</strong><p className="text-xs text-slate-500">{new Date(batch.created_at).toLocaleString(isAr?'ar-EG':'en-GB')}</p></div><Badge color={batch.error_count?'yellow':'green'}>{batch.status}</Badge></div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600"><span>{isAr?'الإجمالي':'Total'}: {batch.total_items}</span><span>{isAr?'جديدة':'Created'}: {batch.created_count}</span><span>{isAr?'محدثة':'Updated'}: {batch.updated_count}</span><span>{isAr?'ملفات':'Charts'}: {batch.chart_count}</span><span>{isAr?'أخطاء':'Errors'}: {batch.error_count}</span></div>
    {batch.error_count>0&&<Btn className="mt-3" variant="secondary" size="xs" icon={<Download size={13}/>} onClick={()=>downloadErrors(batch)}>{isAr?'تنزيل الأخطاء':'Download failures'}</Btn>}
  </div>)}</div>
}

export default function BulkSongManager({ open,onClose,songs,history,isAr,onImport,onUpload }) {
  const [tab,setTab]=useState('songs')
  return <Modal open={open} onClose={onClose} title={isAr?'إدارة مكتبة الترانيم':'Manage song library'} size="full">
    <div className="mb-4 flex items-start gap-3 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800"><AlertTriangle className="mt-0.5 shrink-0" size={17}/><span>{isAr?'راجع المطابقات قبل الحفظ. لا يتم تغيير النص العربي الأصلي أو حذف أي ترنيمة موجودة.':'Review matches before saving. Original Arabic text is preserved and existing songs are never deleted.'}</span></div>
    <Tabs tabs={[{value:'songs',label:isAr?'استيراد الترانيم':'Import songs'},{value:'charts',label:isAr?'رفع Pro Chords':'Upload Pro Chords'},{value:'history',label:isAr?'سجل الاستيراد':'Import history'}]} active={tab} onChange={setTab}/>
    <div className="mt-4">{tab==='songs'?<ImportSongsPane songs={songs} isAr={isAr} onImport={onImport}/>:tab==='charts'?<ChartUploadPane songs={songs} isAr={isAr} onUpload={onUpload}/>:<HistoryPane history={history} isAr={isAr}/>}</div>
  </Modal>
}
