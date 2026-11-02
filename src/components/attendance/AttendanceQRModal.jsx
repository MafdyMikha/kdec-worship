import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../../store/useStore.jsx'
import { useLang } from '../../lib/i18n.jsx'
import { KDEC_LOGO } from '../../assets/kdecLogo.js'
import { attendanceError, nextAttendanceOccurrence } from '../../lib/attendancePolicy.js'
import { attendanceQrCard } from '../../lib/attendanceQr.js'
import { formatAttendanceTime } from '../../lib/attendanceReport.js'
import { Btn, Input, Modal } from '../ui'
import BrandLogo from '../BrandLogo.jsx'

export default function AttendanceQRModal({open,onClose,session}) {
  const {isAr}=useLang(),{manageAttendanceQr}=useStore()
  const [day,setDay]=useState(()=>session?nextAttendanceOccurrence(session):'')
  const [code,setCode]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false),[confirm,setConfirm]=useState('')
  const qrRef=useRef(null),cardRef=useRef(null)
  useEffect(()=>{const changed=()=>{if(!document.fullscreenElement)setExpanded(false)};document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[])
  const close=()=>{if(document.fullscreenElement===cardRef.current)void document.exitFullscreen();setExpanded(false);onClose()}
  const toggleExpanded=async()=>{if(expanded){if(document.fullscreenElement===cardRef.current)await document.exitFullscreen();setExpanded(false)}else{setExpanded(true);try{await cardRef.current?.requestFullscreen?.()}catch{/* Expanded dialog remains available on browsers without fullscreen support. */}}}
  useEffect(()=>{
    if(!open||!session)return
    let active=true
    const load=async()=>{
      setBusy(true);setCode(null);setError('')
      try{const result=await manageAttendanceQr(session.id,day);if(!active)return;if(result.error)setError(attendanceError(result.error,isAr));else setCode(result.data)}
      catch(e){if(active)setError(e.message)}finally{if(active)setBusy(false)}
    }
    void load();return()=>{active=false}
  },[open,session,day,manageAttendanceQr,isAr])
  if(!session)return null
  const url=code&&!code.revoked?`${window.location.origin}/checkin/${code.qr_code}`:''
  const title=session.name||session.service?.title||session.label
  const time=`${formatAttendanceTime(session.sessionTime||session.session_time,isAr)} – ${formatAttendanceTime(session.endTime||session.end_time,isAr)}`
  const change=async action=>{
    setBusy(true);setError('')
    try{const result=await manageAttendanceQr(session.id,day,action);if(result.error)setError(attendanceError(result.error,isAr));else{setCode(result.data);setConfirm('')}}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const makeCard=async()=>{
    const qr=qrRef.current?.querySelector('svg')?.cloneNode(true)
    if(!qr)throw new Error(isAr?'الرمز غير جاهز':'QR is not ready')
    qr.setAttribute('width','400');qr.setAttribute('height','400')
    const response=await fetch(KDEC_LOGO)
    if(!response.ok)throw new Error(isAr?'تعذر تحميل الشعار':'Logo could not be loaded')
    return attendanceQrCard({qrSvg:new XMLSerializer().serializeToString(qr),logoSvg:await response.text(),title,label:session.label,date:day,time,isAr})
  }
  const download=async()=>{
    try{setBusy(true);const svg=await makeCard();const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});const objectUrl=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=objectUrl;anchor.download=`kdec-attendance-${day}.svg`;anchor.click();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000)}catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const print=async()=>{
    const win=window.open('','_blank')
    if(!win){setError(isAr?'اسمح بالنوافذ المنبثقة للطباعة':'Allow popups to print');return}
    try{const svg=await makeCard();win.document.write(`<!doctype html><html><head><title>KDEC Worship QR</title><style>body{margin:0;display:grid;place-items:center}svg{max-width:100%;max-height:96vh}@page{margin:10mm}</style></head><body>${svg}</body></html>`);win.document.close();win.focus();win.print()}catch(e){win.close();setError(e.message)}
  }
  return <Modal open={open} onClose={close} title={isAr?'رمز الحضور الخاص بالموعد':'Attendance QR for this occurrence'} size={expanded?'full':'md'} footer={<div className="flex flex-wrap gap-2"><Btn variant="secondary" onClick={close}>{isAr?'إغلاق':'Close'}</Btn><Btn disabled={!url||busy} onClick={()=>void download()}>{isAr?'تنزيل البطاقة':'Download card'}</Btn><Btn disabled={!url||busy} onClick={()=>void print()}>{isAr?'طباعة':'Print'}</Btn><Btn variant="secondary" onClick={()=>void toggleExpanded()}>{expanded?(isAr?'حجم عادي':'Normal size'):(isAr?'ملء الشاشة':'Full screen')}</Btn></div>}>
    <div className="space-y-4" dir={isAr?'rtl':'ltr'}>
      {session.repeatable&&<Input label={isAr?'موعد الجلسة':'Occurrence date'} type="date" min={session.sessionDate||session.session_date} value={day} onChange={e=>setDay(e.target.value)}/>}
      <div ref={cardRef} className="attendance-qr-card rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center space-y-3">
        {expanded&&<Btn variant="secondary" onClick={()=>void toggleExpanded()}>{isAr?'إنهاء ملء الشاشة':'Exit full screen'}</Btn>}
        <BrandLogo className="w-20 h-auto mx-auto"/><h3 className="text-xl font-semibold break-words" dir="auto">{title}</h3><p className="text-sm text-slate-500"><bdi>{day} · {time}</bdi> · Africa/Cairo</p>
        {busy&&<p role="status">{isAr?'جارٍ تجهيز الرمز…':'Preparing code…'}</p>}
        {url&&!busy&&<div className="mx-auto w-fit max-w-full rounded-xl bg-white p-3" ref={qrRef}><QRCodeSVG value={url} size={expanded?400:264} level="H" includeMargin style={{maxWidth:'100%',height:'auto'}}/></div>}
        {url&&!busy&&<a href={url} className="inline-flex min-h-11 items-center text-indigo-700 underline">{isAr?'فتح صفحة تسجيل الحضور':'Open check-in page'}</a>}
        {code?.revoked&&<p role="status" className="text-red-600">{isAr?'تم إلغاء الرمز. جدّده لإنشاء رمز صالح.':'Code revoked. Regenerate to create a valid code.'}</p>}
        <p className="font-medium">{isAr?'امسح وسجّل الدخول لتسجيل حضورك':'Scan and sign in to check in'}</p><p className="text-xs text-slate-500">{isAr?'المسح وحده لا يثبت التواجد في المكان.':'Scanning alone does not prove physical presence.'}</p>
      </div>
      {error&&<p role="alert" className="text-red-600">{error}</p>}
      {confirm?<div className="rounded-xl border border-amber-200 p-3 space-y-2"><p>{isAr?'الرمز الحالي سيتوقف فورًا. سجلات الحضور تبقى محفوظة.':'The current code will stop working immediately. Attendance records are retained.'}</p><Btn disabled={busy} onClick={()=>void change(confirm)}>{isAr?'تأكيد':'Confirm'}</Btn><Btn variant="ghost" onClick={()=>setConfirm('')}>{isAr?'رجوع':'Cancel'}</Btn></div>:<div className="flex flex-wrap gap-2"><Btn variant="secondary" disabled={busy} onClick={()=>setConfirm('rotate')}>{isAr?'تجديد الرمز':'Regenerate code'}</Btn><Btn variant="danger" disabled={busy||!code||code.revoked} onClick={()=>setConfirm('revoke')}>{isAr?'إلغاء الرمز':'Revoke code'}</Btn></div>}
    </div>
  </Modal>
}
