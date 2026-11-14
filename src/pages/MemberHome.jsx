import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Btn, Modal, Textarea } from '../components/ui'
import Dashboard from './Dashboard.jsx'

function ExcuseModal({ open, onClose, onSubmit, serviceName, isAr }) {
  const [reason, setReason] = useState('')
  return (
    <Modal open={open} onClose={onClose} title={isAr?'تقديم عذر':'Submit Excuse'} size="sm"
      footer={<>
        <Btn variant="secondary" onClick={onClose}>{isAr?'إلغاء':'Cancel'}</Btn>
        <Btn variant="danger" onClick={async()=>{ if(!reason.trim())return; const result=await onSubmit(reason); if(!result?.error){setReason('');onClose()} }} disabled={!reason.trim()}>{isAr?'إرسال العذر':'Send Excuse'}</Btn>
      </>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{isAr?'تقديم عذر عن:':'Excuse for:'} <strong>{serviceName}</strong></p>
        <Textarea label={isAr?'السبب (مطلوب)':'Reason (required)'} required placeholder={isAr?'يرجى توضيح سبب الغياب...':'Please explain your reason...'} value={reason} onChange={e=>setReason(e.target.value)} rows={4}/>
        <p className="text-xs text-slate-400">{isAr?'سيتم مراجعة عذرك من قبل المسؤول.':'Your excuse will be reviewed by the admin.'}</p>
      </div>
    </Modal>
  )
}

function SubModal({ open, onClose, onSubmit, service, myRole, people, isAr }) {
  const [note, setNote] = useState('')
  const subs = people.filter(p => {
    const roles = (Array.isArray(p.roles) && p.roles.length > 0) ? p.roles : (p.role ? [p.role] : [])
    return p.status === 'active' && roles.includes(myRole) && !service?.team.find(t => t.personId === p.id)
  })
  return (
    <Modal open={open} onClose={onClose} title={isAr?'طلب بديل':'Request Substitute'} size="md"
      footer={<><Btn variant="secondary" onClick={onClose}>{isAr?'إلغاء':'Cancel'}</Btn><Btn onClick={async()=>{const result=await onSubmit(note);if(!result?.error){setNote('');onClose()}}}>{isAr?'إرسال الطلب':'Send Request'}</Btn></>}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {isAr
            ? <>لا يمكنك الخدمة كـ <strong>{myRole}</strong> في <strong>{service?.title}</strong>؟</>
            : <>Can't serve as <strong>{myRole}</strong> in <strong>{service?.title}</strong>?</>}
        </p>
        {subs.length===0?(
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            {isAr?'لا يوجد بدائل متاحون بنفس الدور حالياً. سيتم إشعار المسؤول.':'No available substitutes with the same role. Admin will be notified.'}
          </div>
        ):(
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{isAr?`البدائل المتاحة (${subs.length})`:`Available Substitutes (${subs.length})`}</p>
            {subs.map(p=>(
              <div key={p.id} className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                  {p.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                </div>
                <div><div className="text-sm font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-500">{((Array.isArray(p.roles) && p.roles.length>0) ? p.roles : (p.role?[p.role]:[])).join(', ')}</div></div>
              </div>
            ))}
          </div>
        )}
        <Textarea label={isAr?'ملاحظة للبديل (اختياري)':'Note for substitute (optional)'} placeholder={isAr?'أي ملاحظات خاصة...':'Any special notes...'} value={note} onChange={e=>setNote(e.target.value)} rows={3}/>
      </div>
    </Modal>
  )
}

export default function MemberHome() {
  const { isAr } = useLang()
  const { currentUser, people, substituteRequests, submitExcuse, requestSubstitute } = useStore()
  const [excuseModal, setExcuseModal] = useState(null)
  const [subModal, setSubModal] = useState(null)
  const copy = (en, ar) => isAr ? ar : en

  function assignmentActions(service, entry) {
    if (!service || !entry || entry.status === 'declined') return null
    const committed = substituteRequests.some(request =>
      request.service_id === service.id && request.substitute_id === currentUser.id && request.status === 'filled')
    if (committed) return <small>{copy('Assigned substitute', 'مُعيّن كبديل')}</small>
    return <>
      <button type="button" onClick={() => setExcuseModal(service)}>{copy('Submit excuse', 'تقديم عذر')}</button>
      {service.publishedSchedule
        ? <Link to={`/schedule?event=${encodeURIComponent(service.id)}`}>{copy('Replacements', 'البدلاء')}</Link>
        : <button type="button" onClick={() => setSubModal({ service, role: entry.role })}>{copy('Request substitute', 'طلب بديل')}</button>}
    </>
  }

  return <>
    <Dashboard renderAssignmentActions={assignmentActions}/>
    {excuseModal && <ExcuseModal open onClose={() => setExcuseModal(null)} serviceName={excuseModal.title}
      onSubmit={reason => submitExcuse(excuseModal.id, reason)} isAr={isAr}/>}
    {subModal && <SubModal open onClose={() => setSubModal(null)} service={subModal.service} myRole={subModal.role}
      people={people} onSubmit={note => requestSubstitute(subModal.service.id, subModal.role, note)} isAr={isAr}/>}
  </>
}
