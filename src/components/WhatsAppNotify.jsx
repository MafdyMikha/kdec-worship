import { useState } from 'react'
import { Send, Check, Copy, ExternalLink } from 'lucide-react'
import { useStore, buildServiceNotificationMsg, buildWhatsAppUrl } from '../store/useStore.jsx'
import { useLang } from '../lib/i18n.jsx'
import { Modal, Btn, Avatar, StatusDot } from '../components/ui'

const WA = ({size=16}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

export default function WhatsAppNotify({ service }) {
  const { people } = useStore()
  const { isAr, t } = useLang()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState({})
  const [copied, setCopied] = useState({})

  const STATUS_LABEL = isAr
    ? { confirmed:'مؤكد', pending:'انتظار', declined:'معتذر' }
    : { confirmed:'Confirmed', pending:'Pending', declined:'Declined' }
  const STATUS_COLOR = { confirmed:'green', pending:'yellow', declined:'red' }

  const team = (service.team||[]).map(t=>({
    ...t,
    person: t.person || people.find(p=>p.id===t.personId),
  })).filter(t=>t.person)

  const withPhone = team.filter(t=>(t.person?.whatsapp||t.person?.phone))

  const sendOne = (entry) => {
    const p = entry.person
    const phone = p.whatsapp||p.phone
    if (!phone) return
    const msg = buildServiceNotificationMsg(service, p, entry.role)
    const url = buildWhatsAppUrl(phone, msg)
    window.open(url,'_blank')
    setSent(s=>({...s,[entry.personId]:true}))
  }

  const copyLink = (entry) => {
    const p = entry.person
    const phone = p.whatsapp||p.phone
    if (!phone) return
    const msg = buildServiceNotificationMsg(service, p, entry.role)
    const url = buildWhatsAppUrl(phone, msg)
    navigator.clipboard.writeText(url)
    setCopied(s=>({...s,[entry.personId]:true}))
    setTimeout(()=>setCopied(s=>({...s,[entry.personId]:false})),2000)
  }

  const sendAll = () => {
    withPhone.forEach((entry,i) => setTimeout(()=>sendOne(entry), i*600))
  }

  return (
    <>
      <Btn variant="outline" size="sm" onClick={()=>setOpen(true)}
        icon={<WA size={15}/>} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
        {t('notifyTeam')}
      </Btn>

      <Modal open={open} onClose={()=>setOpen(false)} size="md"
        title={`${t('notifyTeam')} — ${service.title}`}
        footer={
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs text-slate-400 flex-1">
              {withPhone.length} {isAr?'لديهم رقم':'have a number'}
            </span>
            <Btn variant="secondary" onClick={()=>setOpen(false)}>{t('close')}</Btn>
            <Btn variant="success" onClick={sendAll} icon={<WA size={14}/>}>
              {t('sendAll')} ({withPhone.length})
            </Btn>
          </div>
        }>
        <div className="space-y-2">
          {team.map(entry=>{
            const p = entry.person
            const hasPhone = !!(p?.whatsapp||p?.phone)
            return (
              <div key={entry.personId}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  sent[entry.personId] ? 'bg-emerald-50 border-emerald-200' : 'border-slate-100 hover:bg-slate-50'
                } ${!hasPhone?'opacity-50':''}`}>
                <Avatar name={p?.name||''} size="sm"/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{p?.name}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">{entry.role}</span>
                    <StatusDot status={entry.status}/>
                    <span className="text-xs text-slate-400">{STATUS_LABEL[entry.status]||entry.status}</span>
                  </div>
                </div>
                {hasPhone ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={()=>copyLink(entry)} title={isAr?'نسخ الرابط':'Copy link'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-all">
                      {copied[entry.personId] ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                    </button>
                    <button onClick={()=>sendOne(entry)}
                      className={`p-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 text-xs font-medium px-2.5 ${
                        sent[entry.personId]
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-700 text-white hover:bg-emerald-800'
                      }`}>
                      {sent[entry.personId] ? <><Check size={13}/> {t('sent')}</> : <><WA size={13}/> {t('send')}</>}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">{t('noPhone')}</span>
                )}
              </div>
            )
          })}
          {team.length===0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              {isAr?'لا يوجد أعضاء في الفريق':'No team members assigned'}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
