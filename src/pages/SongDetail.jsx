import { useState } from 'react'
import { ArrowLeft, Download, Edit2, ExternalLink, FileMusic, Minus, Plus, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { getInlineChordChart, getLatestChartVersion, getSongLyrics, getSongProChords } from '../lib/songLibrary.js'
import { hasPermission } from '../lib/permissions.js'
import { transposeChord } from '../lib/songImport.js'
import { Badge, Btn, Card, EmptyState, Tabs } from '../components/ui'

export default function SongDetail() {
  const {id}=useParams()
  const navigate=useNavigate()
  const {isAr}=useLang()
  const {songs,currentUser,loading,getSongChartUrl,deleteSongChart}=useStore()
  const [tab,setTab]=useState('overview')
  const [semitones,setSemitones]=useState(0)
  const [error,setError]=useState('')
  const song=songs.find(item=>String(item.id)===String(id))
  const canManage=hasPermission(currentUser,'songs.manage')
  const lyrics=getSongLyrics(song)
  const proChords=getSongProChords(song)
  const inlineChart=getInlineChordChart(song)
  const uploadedCharts=(song?.charts||[]).filter(chart=>!chart.isInline)
  const transposedChords=transposeChord(proChords,semitones)
  const displayKey=transposeChord(song?.key||'',semitones)

  const openChart=async(chart,download=false)=>{
    setError('')
    const version=getLatestChartVersion(chart)
    if(version?.rawContent&&!download){
      const blobUrl=URL.createObjectURL(new Blob([version.rawContent],{type:'text/plain;charset=utf-8'}))
      window.open(blobUrl,'_blank','noopener,noreferrer')
      window.setTimeout(()=>URL.revokeObjectURL(blobUrl),60000)
      return
    }
    const response=await getSongChartUrl(version?.storagePath,download)
    if(response?.error){setError(response.error);return}
    window.open(response.url,'_blank','noopener,noreferrer')
  }

  if(loading)return <Card className="p-8 text-center text-slate-500">{isAr?'جارٍ تحميل الترنيمة…':'Loading song…'}</Card>
  if(!song)return <EmptyState title={isAr?'لم يتم العثور على الترنيمة':'Song not found'} action={<Btn onClick={()=>navigate('/songs')}>{isAr?'العودة للترانيم':'Back to Songs'}</Btn>}/>

  const languageLabel=isAr?{ar:'عربي',en:'إنجليزي',both:'ثنائي اللغة'}:{ar:'Arabic',en:'English',both:'Bilingual'}
  return <div className="max-w-5xl space-y-5 animate-fade-in">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <button type="button" onClick={()=>navigate('/songs')} className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" aria-label={isAr?'العودة':'Back'}><ArrowLeft className={isAr?'rotate-180':''} size={18}/></button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900" dir="auto">{song.title}</h1>
          {song.titleEn&&song.titleEn!==song.title&&<p className="mt-1 text-slate-500" dir="ltr">{song.titleEn}</p>}
          <p className="mt-1 text-sm text-slate-500" dir="auto">{song.author|| (isAr?'فنان غير محدد':'Unknown artist')}</p>
        </div>
      </div>
      {canManage&&<Btn variant="secondary" icon={<Edit2 size={15}/>} onClick={()=>navigate('/songs',{state:{editSongId:song.id}})}>{isAr?'تعديل الترنيمة':'Edit song'}</Btn>}
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card className="p-4"><div className="text-xs text-slate-400">{isAr?'الطبقة':'Key'}</div><strong className="mt-1 block text-lg text-slate-800">{song.key||'—'}</strong></Card>
      <Card className="p-4"><div className="text-xs text-slate-400">BPM</div><strong className="mt-1 block text-lg text-slate-800">{song.bpm||'—'}</strong></Card>
      <Card className="p-4"><div className="text-xs text-slate-400">{isAr?'الميزان':'Time signature'}</div><strong className="mt-1 block text-lg text-slate-800">{song.timeSignature||'—'}</strong></Card>
      <Card className="p-4"><div className="text-xs text-slate-400">{isAr?'اللغة':'Language'}</div><strong className="mt-1 block text-sm text-slate-800">{languageLabel[song.language]||song.language}</strong></Card>
    </div>

    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 dark:border-slate-700 p-3 sm:p-4"><Tabs tabs={[
        {value:'overview',label:isAr?'نظرة عامة':'Overview'},
        {value:'lyrics',label:isAr?'الكلمات':'Lyrics',count:lyrics?1:0},
        {value:'chords',label:isAr?'الكوردات':'Chords',count:(proChords?1:0)+uploadedCharts.length},
      ]} active={tab} onChange={setTab}/></div>

      <div className="p-4 sm:p-6">
        {tab==='overview'&&<div className="space-y-5">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <div><dt className="text-slate-400">{isAr?'الفنان / الفنان الأصلي':'Artist / Original Artist'}</dt><dd className="mt-1 font-medium text-slate-800" dir="auto">{song.author||'—'}</dd></div>
            <div><dt className="text-slate-400">CCLI</dt><dd className="mt-1 font-medium text-slate-800">{song.ccliNumber||'—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-400">{isAr?'التصنيفات':'Tags / Categories'}</dt><dd className="mt-2 flex flex-wrap gap-1">{(song.themes||[]).length?(song.themes||[]).map(tag=><Badge key={tag} color="indigo">{tag}</Badge>):'—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-400">{isAr?'ملاحظات':'Notes'}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-700" dir="auto">{song.notes||'—'}</dd></div>
          </dl>
        </div>}

        {tab==='lyrics'&&(lyrics?<pre className="whitespace-pre-wrap break-words font-sans text-base sm:text-lg leading-8 text-slate-800" dir={song.language==='ar'?'rtl':'auto'} style={{unicodeBidi:'plaintext'}}>{lyrics}</pre>:<EmptyState title={isAr?'لا توجد كلمات لهذه الترنيمة':'No lyrics added yet'}/>)}

        {tab==='chords'&&<div className="space-y-5">
          {proChords&&<section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-semibold text-slate-800">{isAr?'ورقة Pro Chords':'Pro Chords Sheet'}</h2><p className="text-xs text-slate-400">{isAr?'الطبقة المعروضة':'Displayed key'}: {displayKey||song.key}</p></div>
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-white dark:hover:bg-slate-600 cursor-pointer" onClick={()=>setSemitones(value=>Math.max(-6,value-1))} aria-label={isAr?'خفض نصف درجة':'Transpose down'}><Minus size={15}/></button>
                <span className="min-w-16 text-center text-xs font-semibold text-slate-700">{semitones>0?`+${semitones}`:semitones}</span>
                <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-white dark:hover:bg-slate-600 cursor-pointer" onClick={()=>setSemitones(value=>Math.min(6,value+1))} aria-label={isAr?'رفع نصف درجة':'Transpose up'}><Plus size={15}/></button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-6">
              <pre className="min-w-max whitespace-pre font-mono text-sm sm:text-base leading-7 text-slate-800" dir="ltr" style={{unicodeBidi:'plaintext'}}>{transposedChords}</pre>
            </div>
            {canManage&&inlineChart&&<Btn variant="ghost" size="sm" className="text-red-500" icon={<Trash2 size={14}/>} onClick={()=>deleteSongChart(inlineChart.id)}>{isAr?'إزالة ورقة الكوردات':'Remove chord sheet'}</Btn>}
          </section>}

          {uploadedCharts.length>0&&<section className="space-y-2">
            <h2 className="font-semibold text-slate-800">{isAr?'ملفات الكوردات':'Uploaded chord files'}</h2>
            {uploadedCharts.map(chart=>{const version=getLatestChartVersion(chart);return <div key={chart.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex min-w-0 items-center gap-3"><FileMusic className="shrink-0 text-violet-500" size={20}/><div className="min-w-0"><strong className="block truncate text-sm text-slate-800">{chart.arrangementName||version?.originalFilename||'Chord chart'}</strong><span className="text-xs text-slate-400">{chart.chartKey||song.key} · {String(chart.chartType||'file').toUpperCase()} · v{version?.version||1}</span></div></div>
              <div className="flex gap-1"><button type="button" onClick={()=>openChart(chart)} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer" aria-label={isAr?'فتح':'Open'}><ExternalLink size={15}/></button><button type="button" onClick={()=>openChart(chart,true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label={isAr?'تنزيل':'Download'}><Download size={15}/></button>{canManage&&<button type="button" onClick={()=>deleteSongChart(chart.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 cursor-pointer" aria-label={isAr?'حذف':'Delete'}><Trash2 size={15}/></button>}</div>
            </div>})}
          </section>}
          {!proChords&&!uploadedCharts.length&&<EmptyState title={isAr?'لا توجد ورقة كوردات لهذه الترنيمة':'No chord sheet added yet'}/>} 
          {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        </div>}
      </div>
    </Card>
  </div>
}
