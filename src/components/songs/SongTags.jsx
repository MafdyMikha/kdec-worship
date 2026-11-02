import { useState } from 'react'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { Btn, Input, Select } from '../ui'
export default function SongTags() {
  const {ministry}=useStore(),{isAr}=useLang()
  const [id,setId]=useState(''),[name,setName]=useState(''),[active,setActive]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false)
  const save=async()=>{setBusy(true);setError('');setSaved(false);try{const result=await ministry.manageTag(id||null,name,active);if(result.error)setError(result.error);else{setId('');setName('');setActive(true);setSaved(true)}}catch(caught){setError(caught.message)}finally{setBusy(false)}}
  return <div className="space-y-4"><p className="text-sm text-slate-500">{isAr?'إعادة التسمية تحدّث كل الترانيم. استخدام اسم موجود يدمج التصنيفين. الأرشفة تحفظ السجل.':'Renaming updates every song. Using an existing name merges tags. Archiving preserves history.'}</p><Select label={isAr?'التصنيف':'Tag'} value={id} onChange={e=>{const tag=ministry.tags.find(row=>row.id===e.target.value);setId(e.target.value);setName(tag?.name||'');setActive(tag?.active??true);setSaved(false)}}><option value="">{isAr?'تصنيف جديد':'New tag'}</option>{ministry.tags.map(tag=><option key={tag.id} value={tag.id}>{tag.name}{tag.active?'':isAr?' (مؤرشف)':' (archived)'}</option>)}</Select><Input label={isAr?'الاسم':'Name'} maxLength={80} value={name} onChange={e=>setName(e.target.value)}/><label className="flex gap-2 items-center"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/>{isAr?'نشط':'Active'}</label><Btn disabled={busy||!name.trim()||!ministry.ready} onClick={save}>{isAr?'حفظ التصنيف':'Save tag'}</Btn>{error&&<p role="alert" className="text-red-700">{error}</p>}{saved&&<p role="status" className="text-emerald-700">{isAr?'تم الحفظ':'Saved'}</p>}</div>
}
