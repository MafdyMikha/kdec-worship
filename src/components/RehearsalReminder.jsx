import { Calendar, ArrowRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../lib/i18n.jsx'
import { Card, Btn } from './ui'

export default function RehearsalReminder({ services, upcomingOnly = true }) {
  const { isAr } = useLang()
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const next = services.filter(service => (!upcomingOnly || !['completed','cancelled'].includes(service.status))
    && service.practice?.enabled && service.practice.date && (!upcomingOnly || service.practice.date >= today))
    .sort((a,b) => `${a.practice.date}T${a.practice.time || '00:00'}`.localeCompare(`${b.practice.date}T${b.practice.time || '00:00'}`))[0]

  return <Card className="p-5 md:p-6">
    <p className="worship-eyebrow">{isAr ? 'وقت للاستعداد' : 'Make room to prepare'}</p>
    <h2 className="text-xl font-display font-medium mb-3">{upcomingOnly ? (isAr ? 'البروفة القادمة' : 'Your next rehearsal') : (isAr ? 'البروفة' : 'Rehearsal')}</h2>
    {next ? <>
      <p className="text-sm text-slate-500 flex items-center gap-2"><Calendar size={16}/>{format(parseISO(next.practice.date),'EEEE, d MMMM',{locale:isAr?ar:undefined})}</p>
      <p className="text-sm text-slate-500 mt-2"><bdi>{next.practice.time}</bdi>{next.practice.location && <> · {next.practice.location}</>}</p>
      <div className="worship-reminder mt-5"><strong className="text-sm" dir="auto">{next.title}</strong><p className="text-sm text-slate-500 mt-1" dir="auto">{next.practice.notes || (isAr ? 'راجع قائمة الترانيم قبل لقائنا.' : 'Review the setlist before we meet.')}</p></div>
      <Btn variant="ghost" className="mt-4 !px-0" onClick={()=>navigate(`/services/${next.id}`)}>{isAr?'مراجعة الترانيم':'Review setlist'}<ArrowRight size={15} className={isAr?'rotate-180':''}/></Btn>
    </> : <p className="text-sm text-slate-500">{isAr ? 'لا توجد بروفات قادمة. ستظهر تفاصيل البروفة هنا عند تحديد موعدها.' : 'No upcoming rehearsals. Details will appear here when a rehearsal is scheduled.'}</p>}
  </Card>
}
