import { KDEC_LOGO } from '../assets/kdecLogo.js'
import { formatClock } from './time.js'
import { scheduleLabels } from './quarterlySchedule.js'

export const escapeScheduleHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

export function schedulePrintHtml({services,slots,people,year,quarter,isAr=false,generatedAt=new Date()}) {
  const esc=escapeScheduleHtml
  const labels=scheduleLabels[isAr?'ar':'en']
  const rows=services.flatMap(service=>{
    const saved=slots.filter(slot=>slot.serviceId===service.id)
    const assignments=saved.length?saved:service.team.map(m=>({personId:m.personId,role:m.role,state:m.status}))
    const rehearsal=service.practice?.enabled?`${service.practice.date} · ${formatClock(service.practice.time)} · ${service.practice.location||''}`:(isAr?'لا توجد بروفة':'No rehearsal')
    return (assignments.length?assignments:[{}]).map(a=>`<tr><td>${esc(service.date)}<br><bdi>${esc(formatClock(service.time))}</bdi></td><td><strong>${esc(service.title)}</strong><br><small>${esc(labels[service.status]||service.status)}${saved.length?'':isAr?' · مسودة':' · Draft'}</small><br><small>${esc(isAr?'البروفة: ':'Rehearsal: ')}<bdi>${esc(rehearsal)}</bdi></small></td><td>${esc(a.role||'—')}</td><td>${esc(people.find(p=>p.id===a.personId)?.name||service.team.find(m=>m.personId===a.personId)?.person?.name||(a.personId?(isAr?'عضو':'Member'):'—'))}</td><td>${esc(labels[a.state]||a.state||labels.vacant)}</td></tr>`)
  }).join('')
  return `<!doctype html><html lang="${isAr?'ar':'en'}" dir="${isAr?'rtl':'ltr'}"><head><meta charset="utf-8"><title>KDEC Worship - Q${quarter} ${year}</title><style>
  @page{size:A4 landscape;margin:16mm 12mm 18mm;@bottom-center{content:counter(page) " / " counter(pages);font:10px Arial;color:#6b5850;direction:ltr;unicode-bidi:isolate}}
  *{box-sizing:border-box}body{font-family:Arial,"Geeza Pro",Tahoma,sans-serif;color:#30251f;background:#fffdf9;margin:0;font-size:11px;line-height:1.6}header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #995f6d;padding-bottom:14px;margin-bottom:16px}header img{width:56px;height:56px;object-fit:contain;background:white;border-radius:12px}h1{font-size:23px;margin:0}p{margin:4px 0;color:#6b5850}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}th{background:#eadfd4;color:#30251f;text-align:start;padding:10px}td{padding:10px;border-bottom:1px solid #d8c8ba;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}tr:nth-child(even){background:#f6efe7}small{color:#67574f}footer{margin-top:16px;padding:12px;background:#f3e7e8;color:#67434c}button{padding:10px;margin:12px;border:0;background:#995f6d;color:white;cursor:pointer}@media print{button{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><header><img src="${KDEC_LOGO}" alt="KDEC Worship"><div><h1>KDEC Worship</h1><p>${isAr?'جدول فريق التسبيح':'Worship team schedule'} · Q${esc(quarter)} ${esc(year)}</p><p>${isAr?'تاريخ التصدير':'Exported'}: ${esc(generatedAt.toLocaleString(isAr?'ar-EG':'en-GB',{timeZone:'Africa/Cairo',hour12:true}))} · Africa/Cairo</p></div></header><table><colgroup><col style="width:14%"><col style="width:32%"><col style="width:19%"><col style="width:20%"><col style="width:15%"></colgroup><thead><tr>${(isAr?['التاريخ والوقت','الخدمة والبروفة','الدور','العضو','الحالة']:['Date & time','Service & rehearsal','Role','Member','Status']).map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="5">${isAr?'لا توجد خدمات لهذا الربع':'No services in this quarter'}</td></tr>`}</tbody></table><footer>${Object.values({pending:labels.pending,confirmed:labels.confirmed,vacant:labels.vacant}).map(esc).join(' · ')}<br>${isAr?'المقترحات الخاصة وبيانات الاتصال غير مدرجة.':'Private proposals and contact details are excluded.'}</footer></body></html>`
}

export function exportQuarterPDF(data) {
  const popup=window.open('','_blank')
  if(!popup)throw new Error(data.isAr?'اسمح بالنوافذ المنبثقة لتصدير PDF':'Allow pop-ups to export the PDF.')
  popup.document.open()
  popup.document.write(schedulePrintHtml(data));popup.document.close()
  const printWhenReady=async()=>{await popup.document.fonts.ready;await Promise.all([...popup.document.images].map(image=>image.decode().catch(()=>{})));if(!popup.closed){popup.focus();popup.print()}}
  if(popup.document.readyState==='complete')void printWhenReady()
  else popup.addEventListener('load',()=>{void printWhenReady()},{once:true})
}
